#!/usr/bin/env python3
"""构建时准备内置 C/C++ 工具链，并验证安装包内的运行器。"""

import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import tarfile
import tempfile
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parent.parent
LOCK = json.loads((ROOT / "script/lec-toolchain.json").read_text())


def verify_archive(archive, expected):
    with archive.open("rb") as stream:
        digest = hashlib.file_digest(stream, "sha256").hexdigest()
    if digest != expected:
        raise ValueError(f"工具链 SHA256 校验失败：{archive}")


def download_archive(asset, cache):
    archive = cache / asset["tarball"].rsplit("/", 1)[1]
    if not archive.exists():
        with tempfile.TemporaryDirectory(dir=cache) as temporary:
            download = Path(temporary) / archive.name
            print(f"下载构建用工具链：{asset['tarball']}", flush=True)
            with urllib.request.urlopen(asset["tarball"], timeout=60) as response:
                with download.open("wb") as output:
                    shutil.copyfileobj(response, output)
            verify_archive(download, asset["shasum"])
            download.replace(archive)
    verify_archive(archive, asset["shasum"])
    return archive


def install(platform, destination, *, debugger=False):
    package = LOCK["debugger"] if debugger else LOCK
    asset = package["platforms"][platform]
    destination = Path(destination).resolve()
    if destination.exists():
        raise ValueError(f"工具链目录已存在，请使用新的打包目录：{destination}")
    cache = ROOT / "target/lec-toolchain-cache"
    if debugger:
        cache = cache / f"codelldb-{package['version']}"
    cache.mkdir(parents=True, exist_ok=True)
    archive = download_archive(asset, cache)
    with tempfile.TemporaryDirectory(dir=cache) as temporary:
        if archive.suffix in [".zip", ".vsix"]:
            with zipfile.ZipFile(archive) as bundle:
                for member in bundle.namelist():
                    if not (Path(temporary) / member).resolve().is_relative_to(Path(temporary).resolve()):
                        raise ValueError("工具链 ZIP 包含越界路径")
                bundle.extractall(temporary)
                if os.name != "nt":
                    for member in bundle.infolist():
                        mode = member.external_attr >> 16 & 0o777
                        if mode:
                            (Path(temporary) / member.filename).chmod(mode)
        else:
            with tarfile.open(archive) as bundle:
                bundle.extractall(temporary, filter="data")
        source = Path(temporary) / ("extension" if debugger else f"zig-{platform}-{package['version']}")
        executable = "zig.exe" if platform.endswith("windows") else "zig"
        required_files = (["adapter/codelldb.exe" if platform.endswith("windows") else "adapter/codelldb",
                           "lldb/lib", "package.json"] if debugger
                          else [executable, "LICENSE", "lib/libc", "lib/libcxx"])
        for required in required_files:
            if not (source / required).exists():
                raise ValueError(f"工具链缺少 {required}")
        # 保留发行包中的全部许可证和运行库来源，避免裁剪时遗漏传递依赖。
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copytree(source, destination, symlinks=True)
    if debugger:
        shutil.copytree(ROOT / "assets/debugger-licenses", destination / "licenses")
        if platform == "aarch64-macos":
            # 新版发行包缺少 debugserver；只补充旧版官方包的辅助程序，保留新版 LLDB 解析器。
            helper = package["macos_debugserver"]
            helper_cache = cache.parent / f"codelldb-{helper['version']}"
            helper_cache.mkdir(parents=True, exist_ok=True)
            helper_archive = download_archive(helper, helper_cache)
            with zipfile.ZipFile(helper_archive) as bundle:
                server = destination / "lldb/bin/debugserver"
                server.parent.mkdir(parents=True, exist_ok=True)
                server.write_bytes(bundle.read("extension/lldb/bin/debugserver"))
                server.chmod(0o755)
    (destination / ("LEC-DEBUGGER.json" if debugger else "LEC-TOOLCHAIN.json")).write_text(
        json.dumps({"version": package["version"], "platform": platform, **asset,
                    "source": package["source"],
                    **({"macos_debugserver": package["macos_debugserver"]} if debugger and platform == "aarch64-macos" else {})}, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"已内置工具链：{destination}", flush=True)


def check(runner):
    runner = Path(runner).resolve()
    executable = "zig.exe" if os.name == "nt" else "zig"
    if not (runner.parent / "toolchains/zig" / executable).is_file():
        raise ValueError("安装包缺少内置工具链，不能使用系统编译器代替验收")
    with tempfile.TemporaryDirectory(prefix="lec-工具链验收 ") as temporary:
        directory = Path(temporary)
        environment = dict(os.environ, PATH="", SDKROOT="/lec-no-sdk",
                           DEVELOPER_DIR="/lec-no-xcode",
                           ZIG_GLOBAL_CACHE_DIR=str(directory / "cache"))
        for name in ["CPATH", "C_INCLUDE_PATH", "CPLUS_INCLUDE_PATH", "LIBRARY_PATH",
                     "DYLD_LIBRARY_PATH", "LD_LIBRARY_PATH", "ZIG_LIB_DIR", "ZIG_LIBC"]:
            environment.pop(name, None)
        (directory / "input.txt").write_text("17", encoding="utf-8")
        sources = {
            "中文 空格.c": '''#include <stdio.h>
#include <math.h>
int main(void) {
    int input, value;
    FILE *file = fopen("input.txt", "r");
    if (!file || fscanf(file, "%d", &value) != 1) return 2;
    fclose(file);
    if (scanf("%d", &input) != 1) return 3;
    printf("RESULT=%d\\n", (int)sqrt((double)(input + value)));
    return 0;
}
''',
            "中文 空格.cpp": '''#include <iostream>
#include <vector>
#include <stdexcept>
int main() {
    int input;
    if (!(std::cin >> input)) return 3;
    try { throw std::runtime_error("test"); }
    catch (const std::exception&) {
        std::cout << "RESULT=" << std::vector<int>{input, 17}[0] + 17 << std::endl;
    }
}
''',
        }
        for name, source in sources.items():
            path = directory / name
            path.write_text(source, encoding="utf-8")
            result = subprocess.run([str(runner), str(path)], input="25\n", text=True,
                                    capture_output=True, env=environment, cwd=ROOT, timeout=300)
            expected = "RESULT=6" if name.endswith(".c") else "RESULT=42"
            if result.returncode or expected not in result.stdout:
                raise RuntimeError(f"内置工具链验收失败：{name}\n{result.stdout}\n{result.stderr}")
            path.write_text("int main(void) { THIS_IS_NOT_VALID; }", encoding="utf-8")
            failed = subprocess.run([str(runner), str(path)], text=True, capture_output=True,
                                    env=environment, cwd=ROOT, timeout=300)
            if not failed.returncode or "RESULT=" in failed.stdout:
                raise RuntimeError("编译失败后错误地执行了程序")
    print("内置工具链验收通过：空 PATH、无 SDK、中文路径、C/C++、标准输入、数学库、异常和编译失败", flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    installer = commands.add_parser("install")
    installer.add_argument("platform", choices=LOCK["platforms"])
    installer.add_argument("destination", type=Path)
    debugger_installer = commands.add_parser("install-debugger")
    debugger_installer.add_argument("platform", choices=LOCK["debugger"]["platforms"])
    debugger_installer.add_argument("destination", type=Path)
    checker = commands.add_parser("check")
    checker.add_argument("runner", type=Path)
    arguments = parser.parse_args()
    if arguments.command == "install":
        install(arguments.platform, arguments.destination)
    elif arguments.command == "install-debugger":
        install(arguments.platform, arguments.destination, debugger=True)
    else:
        check(arguments.runner)
