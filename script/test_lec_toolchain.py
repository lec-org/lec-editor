"""检查构建工具链时的完整性和解包边界。"""

import hashlib
import importlib.util
from pathlib import Path
import plistlib
import tarfile
import tempfile
import unittest
from unittest.mock import patch
import zipfile

SPEC = importlib.util.spec_from_file_location("lec_toolchain", Path(__file__).with_name("lec-toolchain.py"))
TOOLCHAIN = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(TOOLCHAIN)
BUNDLE_SPEC = importlib.util.spec_from_file_location("lec_bundle", Path(__file__).with_name("bundle-lec-unix.py"))
BUNDLE = importlib.util.module_from_spec(BUNDLE_SPEC)
BUNDLE_SPEC.loader.exec_module(BUNDLE)


class ToolchainTests(unittest.TestCase):
    def test_unix_packages_keep_the_runner_and_toolchain_beside_the_editor(self):
        for system, target in [("Darwin", "aarch64-apple-darwin"),
                               ("Linux", "aarch64-unknown-linux-gnu")]:
            with self.subTest(system=system), tempfile.TemporaryDirectory() as temporary:
                root = Path(temporary)
                files = {
                    "crates/zed/Cargo.toml": 'version = "1.28.1"',
                    f"target/{target}/release/leceditor": "editor",
                    f"target/{target}/release/lec-run": "runner",
                    "LICENSE-GPL": "license", "docs/lec/THIRD_PARTY.md": "notices",
                    "assets/licenses.md": "licenses",
                    "crates/zed/resources/app-icon.png": "icon",
                    "crates/zed/resources/app-icon@2x.png": "icon",
                }
                for name, contents in files.items():
                    path = root / name
                    path.parent.mkdir(parents=True, exist_ok=True)
                    path.write_text(contents, encoding="utf-8")
                checked = []

                def packaging_command(*arguments, **options):
                    if "install" in arguments:
                        destination = Path(arguments[-1])
                        destination.mkdir(parents=True)
                        (destination / "zig").write_text("compiler")
                    if "check" in arguments:
                        runner = Path(arguments[-1])
                        self.assertEqual(runner.read_text(), "runner")
                        self.assertEqual((runner.parent / "leceditor").read_text(), "editor")
                        self.assertTrue((runner.parent / "toolchains/zig/zig").exists())
                        checked.append(runner)
                    if arguments[0] == "hdiutil":
                        stage = Path(arguments[arguments.index("-srcfolder") + 1])
                        app = stage / "LEC Editor.app"
                        with (app / "Contents/Info.plist").open("rb") as stream:
                            info = plistlib.load(stream)
                        self.assertEqual(info["CFBundleExecutable"], "leceditor")
                        self.assertEqual(info["CFBundleIdentifier"], "org.lec.Editor")
                        self.assertTrue((app / "Contents/Resources/THIRD_PARTY.md").exists())
                        self.assertEqual(len(checked), 1)

                with patch.object(BUNDLE, "ROOT", root), patch.object(BUNDLE.platform, "system", return_value=system), \
                        patch.object(BUNDLE.platform, "machine", return_value="aarch64"), \
                        patch.object(BUNDLE, "run", side_effect=packaging_command), \
                        patch.object(BUNDLE.subprocess, "check_output", return_value=""):
                    BUNDLE.bundle(skip_build=True)
                self.assertEqual(len(checked), 1)
                if system == "Linux":
                    with tarfile.open(root / "dist/lec-editor-linux-aarch64.tar.gz") as archive:
                        for name in ["bin/leceditor", "bin/lec-run", "bin/toolchains/zig/zig", "THIRD_PARTY.md"]:
                            self.assertIn(f"lec-editor/{name}", archive.getnames())

    def test_install_preserves_runtime_and_licenses_for_zip_and_tar(self):
        for extension in ["zip", "tar.xz"]:
            with self.subTest(extension=extension), tempfile.TemporaryDirectory() as temporary:
                root = Path(temporary)
                cache = root / "target/lec-toolchain-cache"
                cache.mkdir(parents=True)
                source = root / "zig-test-1.0"
                for name in ["zig", "LICENSE", "lib/libc/include/stdio.h", "lib/libcxx/LICENSE.TXT"]:
                    path = source / name
                    path.parent.mkdir(parents=True, exist_ok=True)
                    path.write_text(name, encoding="utf-8")
                archive = cache / f"zig-test-1.0.{extension}"
                if extension == "zip":
                    with zipfile.ZipFile(archive, "w") as bundle:
                        for path in source.rglob("*"):
                            bundle.write(path, path.relative_to(root))
                else:
                    with tarfile.open(archive, "w:xz") as bundle:
                        bundle.add(source, arcname=source.name)
                lock = {"version": "1.0", "source": "https://example.com/source",
                        "platforms": {"test": {"tarball": f"https://example.com/{archive.name}",
                                               "shasum": hashlib.sha256(archive.read_bytes()).hexdigest()}}}
                destination = root / "安装 目录/toolchains/zig"
                with patch.object(TOOLCHAIN, "ROOT", root), patch.object(TOOLCHAIN, "LOCK", lock):
                    TOOLCHAIN.install("test", destination)
                    self.assertEqual((destination / "lib/libc/include/stdio.h").read_text(),
                                     "lib/libc/include/stdio.h")
                    self.assertTrue((destination / "lib/libcxx/LICENSE.TXT").exists())
                    self.assertTrue((destination / "LEC-TOOLCHAIN.json").exists())
                    with self.assertRaises(ValueError):
                        TOOLCHAIN.install("test", destination)
                    archive.write_bytes(b"corrupted")
                    with self.assertRaisesRegex(ValueError, "SHA256"):
                        TOOLCHAIN.install("test", root / "another")
                    self.assertFalse((root / "another").exists())

    def test_check_rejects_a_runner_without_a_bundled_toolchain(self):
        with tempfile.TemporaryDirectory() as temporary:
            with self.assertRaisesRegex(ValueError, "缺少内置工具链"):
                TOOLCHAIN.check(Path(temporary) / "lec-run")

    def test_zip_cannot_write_outside_the_extraction_directory(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            cache = root / "target/lec-toolchain-cache"
            cache.mkdir(parents=True)
            archive = cache / "unsafe.zip"
            with zipfile.ZipFile(archive, "w") as bundle:
                bundle.writestr("../escaped", "不能写到解包目录外")
            lock = {"platforms": {"test": {"tarball": "https://example.com/unsafe.zip",
                                           "shasum": hashlib.sha256(archive.read_bytes()).hexdigest()}}}
            with patch.object(TOOLCHAIN, "ROOT", root), patch.object(TOOLCHAIN, "LOCK", lock):
                with self.assertRaisesRegex(ValueError, "越界路径"):
                    TOOLCHAIN.install("test", root / "destination")
            self.assertFalse((cache / "escaped").exists())


if __name__ == "__main__":
    unittest.main()
