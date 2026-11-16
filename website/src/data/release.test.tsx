import { describe, expect, test } from "bun:test";
import { renderToString } from "react-dom/server";
import { App } from "../App";
import { validateRelease, type Release } from "./release";

const manifest = (): Release => ({
  tag: "lec-v1.28.2",
  commit: "example",
  files: [
    {
      name: "line-macos-aarch64.dmg",
      size: 100,
      sha256: "a".repeat(64),
      github: "https://github.com/lec-org/lec-editor/releases/download/lec-v1.28.2/line-macos-aarch64.dmg",
      gitee: { parts: [], command: null },
    },
  ],
});

describe("下载清单", () => {
  test("允许空清单和正式下载地址", () => {
    expect(validateRelease({ tag: null, commit: null, files: [] }).files).toHaveLength(0);
    expect(validateRelease(manifest()).files).toHaveLength(1);
  });
  test("拒绝错误摘要和无效文件大小", () => {
    const release = manifest();
    const file = release.files[0];
    if (!file) throw new Error("缺少测试制品");
    file.sha256 = "invalid";
    expect(() => validateRelease(release)).toThrow();
    file.sha256 = "a".repeat(64);
    for (const size of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
      file.size = size;
      expect(() => validateRelease(release)).toThrow();
    }
  });
  test("拒绝跨域、明文、含凭据或查询参数的下载地址", () => {
    for (const github of [
      "javascript:alert(1)",
      "http://github.com/file",
      "https://github.com.evil.example/file",
      "https://user:password@github.com/file",
      "https://github.com/file?token=example",
    ]) {
      const release = manifest();
      const file = release.files[0];
      if (!file) throw new Error("缺少测试制品");
      file.github = github;
      expect(() => validateRelease(release)).toThrow();
    }
  });
  test("Gitee 分卷也必须来自指定下载域名", () => {
    const release = manifest();
    const file = release.files[0];
    if (!file) throw new Error("缺少测试制品");
    const part = { name: "part", size: 100, url: "https://evil.example/part" };
    file.gitee.parts = [part];
    expect(() => validateRelease(release)).toThrow();
    part.url = "https://gitee.com/lec-org/lec-editor/attach_files/file";
    expect(validateRelease(release).files).toHaveLength(1);
  });
});

test("正文在构建时可渲染，不依赖浏览器全局对象", () => {
  const html = renderToString(<App />);
  expect(html).toContain("从第一行代码，");
  expect(html).toContain('id="main"');
  expect(html).toContain("Powered by");
  expect(html).toContain("乐程软件工作室");
  expect(html).toContain('id="run-demo"');
  expect(html).toContain('id="debug-next"');
});
