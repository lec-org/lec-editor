#!/usr/bin/env python3
"""生成包含 C/C++ 工具链的 LEC Editor macOS / Linux 安装包。"""

import argparse
import os
from pathlib import Path
import platform
import plistlib
import re
import shutil
import subprocess
import sys
import tarfile
import tempfile

ROOT = Path(__file__).resolve().parent.parent


def run(*arguments, **options):
    subprocess.run(arguments, cwd=ROOT, check=True, **options)


def bundle(skip_build):
    system = {"Darwin": "macos", "Linux": "linux"}[platform.system()]
    architecture = {"arm64": "aarch64", "aarch64": "aarch64", "x86_64": "x86_64"}[platform.machine()]
    target = f"{architecture}-" + ("apple-darwin" if system == "macos" else "unknown-linux-gnu")
    version = re.search(r'^version = "([^"]+)"', (ROOT / "crates/zed/Cargo.toml").read_text(), re.M)[1]
    environment = dict(os.environ, ZED_RELEASE_CHANNEL="stable", RELEASE_CHANNEL="stable",
                       RELEASE_VERSION=version)
    if not skip_build:
        run("script/generate-licenses", env=environment)
        run("rustup", "target", "add", target)
        arguments = ["cargo", "--config", ".cargo/bundle-config.toml", "build", "--locked", "--release", "--target", target,
                     "-p", "zed", "--bin", "leceditor", "-p", "c_runner", "--bin", "lec-run"]
        if system == "macos":
            arguments += ["--features", "gpui_platform/runtime_shaders"]
        run(*arguments, env=environment)
    output = ROOT / "target" / target / "release"
    with tempfile.TemporaryDirectory(prefix="lec-bundle-", dir=ROOT / "target") as temporary:
        stage = Path(temporary) / ("LEC Editor.app" if system == "macos" else "lec-editor")
        binaries = stage / ("Contents/MacOS" if system == "macos" else "bin")
        binaries.mkdir(parents=True)
        for name in ["leceditor", "lec-run"]:
            shutil.copy2(output / name, binaries / name)
            run("strip", "-S" if system == "macos" else "--strip-unneeded", str(binaries / name))
        if system == "linux":
            # 沿用上游发布包携带 libstdc++ 的方式，避免依赖构建机的新版本符号。
            dependencies = subprocess.check_output(["ldd", str(binaries / "leceditor")], text=True)
            for library in re.findall(r"libstdc\+\+\.so\.6 => (\S+)", dependencies):
                (stage / "lib").mkdir(exist_ok=True)
                shutil.copy2(library, stage / "lib/libstdc++.so.6")
        for name in ["LICENSE-GPL", "docs/lec/THIRD_PARTY.md", "assets/licenses.md"]:
            destination = stage / "Contents/Resources" if system == "macos" else stage
            destination.mkdir(parents=True, exist_ok=True)
            shutil.copy2(ROOT / name, destination / Path(name).name)
        run(sys.executable, "script/lec-toolchain.py", "install", f"{architecture}-{system}",
            str(binaries / "toolchains/zig"))
        if system == "macos":
            resources = stage / "Contents/Resources"
            iconset = Path(temporary) / "LECEditor.iconset"
            iconset.mkdir()
            for name, source in [("icon_512x512.png", "app-icon.png"),
                                 ("icon_512x512@2x.png", "app-icon@2x.png")]:
                shutil.copy2(ROOT / "crates/zed/resources" / source, iconset / name)
            run("iconutil", "-c", "icns", str(iconset), "-o", str(resources / "LECEditor.icns"))
            shutil.rmtree(iconset)
            with (stage / "Contents/Info.plist").open("wb") as stream:
                plistlib.dump({
                    "CFBundleExecutable": "leceditor", "CFBundleName": "LEC Editor",
                    "CFBundleDisplayName": "LEC Editor", "CFBundleIdentifier": "org.lec.Editor",
                    "CFBundlePackageType": "APPL", "CFBundleVersion": version,
                    "CFBundleShortVersionString": version, "CFBundleIconFile": "LECEditor.icns",
                    "LSMinimumSystemVersion": "12.0", "NSHighResolutionCapable": True,
                    "NSPrincipalClass": "NSApplication",
                    "CFBundleDocumentTypes": [{"CFBundleTypeName": "C/C++ 源文件",
                                               "CFBundleTypeRole": "Editor", "LSHandlerRank": "Alternate",
                                               "CFBundleTypeExtensions": ["c", "cpp", "cc", "cxx", "h", "hpp"]}],
                }, stream)
            # 工具链同样包含 Mach-O 文件；在最终 .app 上统一完成本地签名。
            run("codesign", "--force", "--deep", "--sign", "-", str(stage))
        run(sys.executable, "script/lec-toolchain.py", "check", str(binaries / "lec-run"))
        dist = ROOT / "dist"
        dist.mkdir(exist_ok=True)
        if system == "macos":
            (Path(temporary) / "Applications").symlink_to("/Applications")
            run("hdiutil", "create", "-volname", "LEC Editor", "-srcfolder", temporary,
                "-ov", "-format", "ULMO", str(dist / f"lec-editor-macos-{architecture}.dmg"))
        else:
            with tarfile.open(dist / f"lec-editor-linux-{architecture}.tar.gz", "w:gz") as archive:
                archive.add(stage, arcname=stage.name)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--skip-build", action="store_true", help="使用已生成的 Release 二进制")
    bundle(parser.parse_args().skip_build)
