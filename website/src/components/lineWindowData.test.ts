import { expect, test } from "bun:test";
import { fileByPath, files, highlight, outline, searchFiles, tree, type TreeNode } from "./lineWindowData";

test("C/C++ 与 Markdown 高亮不会丢失或改写源代码", () => {
  for (const file of files) {
    for (const line of file.code.split("\n")) {
      expect(
        highlight(line, file.language)
          .map((token) => token.text)
          .join(""),
      ).toBe(line);
    }
  }
  expect(highlight("#include <stdio.h>", "c").find((token) => token.text === "#include")?.kind).toBe("attribute");
  expect(highlight("int value = 3;", "c").find((token) => token.text === "int")?.kind).toBe("type");
  expect(highlight('printf("你好，Line!\\n");', "c").find((token) => token.kind === "string")?.text).toBe(
    '"你好，Line!\\n"',
  );
});

test("搜索支持中文、大小写和完整单词，空查询没有结果", () => {
  expect(searchFiles("")).toEqual([]);
  expect(searchFiles("不存在的内容")).toEqual([]);
  expect(searchFiles("求和").some((result) => result.file.path === "README.md")).toBe(true);
  expect(searchFiles("VALUE")).toEqual(searchFiles("value"));
  expect(searchFiles("VALUE", true)).toEqual([]);
  expect(searchFiles("val", false, true)).toEqual([]);
  expect(searchFiles("value", false, true).length).toBeGreaterThan(0);
});

test("C 大纲定位函数定义，搜索结果定位到原始行列", () => {
  const file = fileByPath.get("main.c");
  if (!file) throw new Error("缺少 main.c 示例");
  expect(outline(file).map((item) => item.label)).toEqual(["add()", "main()"]);
  for (const result of searchFiles("value")) {
    for (const match of result.matches) {
      expect(result.file.code.split("\n")[match.index]?.slice(match.column, match.column + 5)).toBe("value");
    }
  }
});

test("文件树中的每个文件均可打开，调试步骤指向有效代码行", () => {
  const paths: string[] = [];
  function visit(node: TreeNode) {
    if (typeof node === "string") paths.push(node);
    else node.children.forEach(visit);
  }
  visit(tree);
  expect(new Set(paths)).toEqual(new Set(files.map((file) => file.path)));
  for (const file of files) {
    for (const step of file.steps ?? []) {
      expect(file.code.split("\n")[step.line]?.trim().length).toBeGreaterThan(0);
    }
    if (file.steps) expect(file.steps.at(-1)?.output).toBe(file.output);
  }
});
