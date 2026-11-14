#!/usr/bin/env python3
"""验证内置调试器可以在 C/C++ 断点暂停、读取变量并单步执行。"""

import argparse
import json
import os
from pathlib import Path
import socket
import subprocess
import tempfile
import time


def check(runner):
    runner = Path(runner).resolve()
    suffix = ".exe" if os.name == "nt" else ""
    adapter = runner.parent / f"toolchains/codelldb/adapter/codelldb{suffix}"
    if not adapter.is_file():
        raise ValueError("安装包缺少内置调试器")
    with tempfile.TemporaryDirectory(prefix="line 调试验收 ") as temporary:
        directory = Path(temporary).resolve()
        environment = dict(os.environ, PATH="", SDKROOT="/line-no-sdk", DEVELOPER_DIR="/line-no-xcode")
        for extension in ["c", "cpp"]:
            source = directory / f"中文 断点.{extension}"
            source.write_text('#include <stdio.h>\nint main(void) {\n    int value = 1;\n    value += 2;\n    value *= 3;\n    printf("VALUE=%d\\n", value);\n    return value == 9 ? 0 : 1;\n}\n', encoding="utf-8")
            program = directory / f"program-{extension}{suffix}"
            subprocess.run([str(runner), "--compile-only", str(source), str(program)],
                           env=environment, cwd=directory, check=True, timeout=300)
            with socket.socket() as listener, tempfile.TemporaryFile() as log:
                listener.bind(("127.0.0.1", 0))
                listener.listen(1)
                listener.settimeout(30)
                process = subprocess.Popen([str(adapter), "--connect", str(listener.getsockname()[1])],
                                           cwd=directory, env=environment, stdout=log, stderr=log)
                try:
                    connection, _ = listener.accept()
                    with connection:
                        connection.settimeout(30)
                        stream = connection.makefile("rb")
                        sequence = 0
                        pending = []

                        def send(command, arguments=None):
                            nonlocal sequence
                            sequence += 1
                            message = json.dumps(dict(seq=sequence, type="request", command=command,
                                                      arguments=arguments or {})).encode()
                            connection.sendall(f"Content-Length: {len(message)}\r\n\r\n".encode() + message)
                            return sequence

                        def wait(predicate):
                            deadline = time.monotonic() + 30
                            while time.monotonic() < deadline:
                                for index, message in enumerate(pending):
                                    if predicate(message):
                                        return pending.pop(index)
                                length = None
                                while True:
                                    line = stream.readline()
                                    if not line:
                                        raise RuntimeError(f"调试器提前断开连接，退出码 {process.poll()}，事件 {pending}")
                                    if line == b"\r\n":
                                        break
                                    key, value = line.decode().split(":", 1)
                                    if key.lower() == "content-length":
                                        length = int(value)
                                if length is None or not 0 < length <= 16 * 1024 * 1024:
                                    raise RuntimeError("调试器返回无效消息长度")
                                message = json.loads(stream.read(length))
                                if message.get("type") == "response" and not message.get("success"):
                                    raise RuntimeError(f"调试请求失败：{message}")
                                pending.append(message)
                            raise TimeoutError("等待调试事件超时")

                        def response(sequence):
                            return wait(lambda message: message.get("request_seq") == sequence)

                        def request(command, arguments=None):
                            return response(send(command, arguments)).get("body", {})

                        def event(name):
                            return wait(lambda message: message.get("event") == name).get("body", {})

                        request("initialize", dict(adapterID="codelldb", clientID="line-check", pathFormat="path",
                                                   linesStartAt1=True, columnsStartAt1=True,
                                                   supportsRunInTerminalRequest=False))
                        launch = send("launch", dict(program=str(program), cwd=str(directory), terminal="console",
                                                     stopOnEntry=False, preRunCommands=["breakpoint set --name main --one-shot true"]))
                        event("initialized")
                        breakpoints = request("setBreakpoints", dict(source=dict(path=str(source)),
                                                                    breakpoints=[dict(line=4)]))
                        assert breakpoints["breakpoints"][0]["verified"], breakpoints
                        request("configurationDone")
                        response(launch)
                        entry = event("stopped")
                        frames = request("stackTrace", dict(threadId=entry["threadId"]))["stackFrames"]
                        assert "main" in frames[0]["name"], frames[0]
                        request("continue", dict(threadId=entry["threadId"]))
                        stopped = event("stopped")
                        assert stopped["reason"] == "breakpoint", stopped
                        thread = stopped["threadId"]

                        def value():
                            frames = request("stackTrace", dict(threadId=thread))["stackFrames"]
                            assert Path(frames[0]["source"]["path"]).resolve() == source.resolve(), frames[0]
                            scopes = request("scopes", dict(frameId=frames[0]["id"]))["scopes"]
                            for scope in scopes:
                                variables = request("variables", dict(variablesReference=scope["variablesReference"]))["variables"]
                                for variable in variables:
                                    if variable["name"] == "value":
                                        return variable["value"]
                            raise AssertionError("无法在变量面板中读取 value")

                        assert value() == "1"
                        request("next", dict(threadId=thread))
                        event("stopped")
                        assert value() == "3"
                        request("continue", dict(threadId=thread))
                        assert event("exited")["exitCode"] == 0
                        request("disconnect", dict(terminateDebuggee=True))
                        print(f"{extension.upper()} 调试通过：中文路径、断点、源码定位、变量、单步、继续和正常退出", flush=True)
                except Exception as error:
                    log.seek(0)
                    raise RuntimeError(f"{error}\n{log.read().decode(errors='replace')}") from error
                finally:
                    if process.poll() is None:
                        process.terminate()
                    process.wait(timeout=10)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("runner", type=Path)
    check(parser.parse_args().runner)
