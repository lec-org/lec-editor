import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { checksum, giteeParts, publicDownloadUrl } from "./lec-release.mjs";

test("Gitee 分卷还原后与原始安装包完全一致，边界大小不分卷", async () => {
  const directory = await mkdtemp(join(tmpdir(), "lec-release-"));
  try {
    const path = join(directory, "editor.exe");
    const content = Buffer.from("1234567890");
    await writeFile(path, content);
    const result = await giteeParts(path, join(directory, "parts"), 4);
    assert.deepEqual(
      result.parts.map((part) => part.size),
      [4, 4, 2],
    );
    assert.deepEqual(Buffer.concat(await Promise.all(result.parts.map((part) => readFile(part.path)))), content);
    assert.equal(result.sha256, await checksum(path));
    assert.equal((await giteeParts(path, join(directory, "single"), 10)).parts.length, 1);
    await writeFile(path, "");
    await assert.rejects(giteeParts(path, join(directory, "empty")), /空制品/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("公开下载地址不能携带凭据或指向其他站点", () => {
  assert.equal(
    publicDownloadUrl("https://gitee.com/lec-org/lec-editor/attach_files/1/download"),
    "https://gitee.com/lec-org/lec-editor/attach_files/1/download",
  );
  for (const url of [
    "javascript:alert(1)",
    "https://evil.com/file",
    "https://gitee.com/file?access_token=secret",
    "https://name:secret@gitee.com/file",
  ]) {
    assert.throws(() => publicDownloadUrl(url));
  }
});

test("仅发布 GitHub 无需 Gitee 凭据，附件失败时保留草稿", {
  skip: process.platform === "win32" ? "发布任务使用 Linux，替身命令依赖 POSIX 可执行脚本" : false,
}, async () => {
  for (const failUpload of [false, true]) {
    const directory = await mkdtemp(join(tmpdir(), "line-publish-"));
    try {
      const binaries = join(directory, "bin");
      const dist = join(directory, "dist");
      const callsPath = join(directory, "calls.jsonl");
      await mkdir(binaries);
      await mkdir(dist);
      const names = ["line-macos-aarch64.dmg", "line-windows-x86_64.exe", "line-linux-x86_64.tar.gz"];
      for (const name of names) await writeFile(join(dist, name), `安装包 ${name}`);
      await writeFile(join(binaries, "gh"), `#!/usr/bin/env node
const {appendFileSync} = require('node:fs');
const args = process.argv.slice(2);
appendFileSync(process.env.LEC_TEST_CALLS, JSON.stringify(args) + '\\n');
if (args[1] === 'list') process.stdout.write('[]');
if (args[1] === 'upload' && args[3].endsWith('.exe') && process.env.LEC_TEST_FAIL === 'true') process.exit(1);
`, { mode: 0o755 });
      const result = spawnSync(process.execPath, [fileURLToPath(new URL("./lec-release.mjs", import.meta.url)), "lec-v1.28.1", dist], {
        encoding: "utf8",
        env: {
          ...process.env,
          PATH: `${binaries}:${process.env.PATH}`,
          RELEASE_COMMIT: "a".repeat(40),
          PUBLISH_GITEE: "false",
          GITEE_TOKEN: "",
          LEC_TEST_CALLS: callsPath,
          LEC_TEST_FAIL: String(failUpload),
        },
      });
      const calls = (await readFile(callsPath, "utf8")).trim().split("\n").map(line => JSON.parse(line));
      assert.ok(calls.some(args => args[1] === "create" && args.includes("--draft")));
      assert.equal(calls.some(args => args[1] === "edit" && args.includes("--draft=false")), !failUpload);
      assert.equal(result.status, failUpload ? 1 : 0, result.stderr);
      if (!failUpload) {
        const manifest = JSON.parse(await readFile(join(dist, "downloads.json"), "utf8"));
        assert.equal(manifest.commit, "a".repeat(40));
        assert.deepEqual(manifest.files.map(file => file.name), names);
        for (const file of manifest.files) {
          assert.equal(file.sha256, await checksum(join(dist, file.name)));
          assert.deepEqual(file.gitee, { parts: [], command: null });
        }
        assert.deepEqual(calls.filter(args => args[1] === "upload").map(args => basename(args[3])), [...names, "downloads.json", "SHA256SUMS"]);
        assert.ok(!(await readdir(dist)).includes("RESTORE.md"));
        assert.ok(!(await readFile(join(dist, "RELEASE.md"), "utf8")).includes("Gitee"));
      }
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }
});
