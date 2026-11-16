// SPDX-License-Identifier: GPL-3.0-or-later
// 改编自 dstrml/wu 的 wuWindowData.ts，来源提交与原作者见 website/NOTICE.md。
// 2026-11-16：替换为 Line C/C++ 示例，并增加搜索与调试演示数据。
import { BASE_PATH } from "../data/release";

export type Language = "c" | "cpp" | "markdown";
export interface DebugStep {
  line: number;
  variables: Record<string, string>;
  output?: string;
}
export interface MockFile {
  path: string;
  language: Language;
  firstLine: number;
  code: string;
  output?: string;
  steps?: DebugStep[];
}
export interface TreeFolder {
  name: string;
  path: string;
  children: TreeNode[];
}
export type TreeNode = TreeFolder | string;

export const files: MockFile[] = [
  {
    path: "main.c",
    language: "c",
    firstLine: 1,
    code: `#include <stdio.h>

int add(int left, int right) {
    return left + right;
}

int main(void) {
    int value = 1;
    value = add(value, 2);
    printf("value = %d\\n", value);
    return 0;
}`,
    output: "value = 3",
    steps: [
      { line: 7, variables: {} },
      { line: 8, variables: { value: "1" } },
      { line: 9, variables: { value: "3" } },
      { line: 10, variables: { value: "3" }, output: "value = 3" },
    ],
  },
  {
    path: "练习/循环.c",
    language: "c",
    firstLine: 1,
    code: `#include <stdio.h>

int main(void) {
    int sum = 0;
    for (int number = 1; number <= 5; number++) {
        sum += number;
    }
    printf("1 到 5 的和是 %d\\n", sum);
    return 0;
}`,
    output: "1 到 5 的和是 15",
    steps: [
      { line: 4, variables: { sum: "0" } },
      { line: 5, variables: { sum: "0", number: "1" } },
      { line: 5, variables: { sum: "1", number: "2" } },
      { line: 5, variables: { sum: "3", number: "3" } },
      { line: 5, variables: { sum: "6", number: "4" } },
      { line: 5, variables: { sum: "10", number: "5" } },
      { line: 7, variables: { sum: "15" } },
      { line: 8, variables: { sum: "15" }, output: "1 到 5 的和是 15" },
    ],
  },
  {
    path: "练习/问候.cpp",
    language: "cpp",
    firstLine: 1,
    code: `#include <iostream>
#include <string>

int main() {
    std::string name = "Line";
    std::cout << "Hello, " << name << "!" << std::endl;
    return 0;
}`,
    output: "Hello, Line!",
    steps: [
      { line: 4, variables: {} },
      { line: 5, variables: { name: '"Line"' } },
      { line: 6, variables: { name: '"Line"' }, output: "Hello, Line!" },
    ],
  },
  {
    path: "README.md",
    language: "markdown",
    firstLine: 1,
    code: `# 我的第一份程序

欢迎使用 Line。试着点击左侧的文件和面板。

## 编写
- main.c：函数与变量
- 循环.c：循环与求和
- 问候.cpp：C++ 输出

## 运行与调试
- 点击「运行演示」查看预设输出。
- 点击行号设置断点，在调试面板观察变量。
- 这里是网页交互演示，不会编译或保存你的代码。

## 下载
安装 Line 后，即可使用内置工具链编译运行自己的程序。`,
  },
];
export const fileByPath = new Map(files.map((file) => [file.path, file]));
export const tree: TreeFolder = {
  name: "C语言练习",
  path: "",
  children: ["main.c", { name: "练习", path: "练习", children: ["练习/循环.c", "练习/问候.cpp"] }, "README.md"],
};
export const initiallyExpanded = ["", "练习"];

export type TokenKind =
  | "keyword"
  | "type"
  | "function"
  | "string"
  | "number"
  | "comment"
  | "property"
  | "punctuation"
  | "self"
  | "constant"
  | "attribute"
  | "title"
  | "emphasis"
  | "link"
  | "marker"
  | "literal";

export interface Token {
  text: string;
  kind?: TokenKind;
}

const cKeywords = new Set(
  "auto break case const continue default do else enum extern for goto if inline namespace new delete operator private protected public return sizeof static struct switch template typedef typename union using virtual volatile while".split(
    " ",
  ),
);
const cTypes = new Set("bool char double float int long short signed unsigned void string size_t".split(" "));

function highlightC(line: string): Token[] {
  const tokens: Token[] = [];
  const pattern =
    /(\/\/.*)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|<[\w./]+>)|(#[ \t]*[A-Za-z_]+)|(\b\d[\d_]*(?:\.\d+)?\b)|([A-Za-z_][A-Za-z0-9_]*)|(->|=>|==|<=|>=|&&|\|\||[-+*/=<>!&|?]=?)|([{}()[\];,.:@'])|(\s+)|(.)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(line))) {
    const [text, comment, string, attribute, number, word, operator] = match;
    if (comment) tokens.push({ text, kind: "comment" });
    else if (string) tokens.push({ text, kind: "string" });
    else if (attribute) tokens.push({ text, kind: "attribute" });
    else if (number) tokens.push({ text, kind: "number" });
    else if (word) tokens.push({ text, kind: classifyCWord(word, line, match.index) });
    else if (operator) tokens.push({ text, kind: "punctuation" });
    else tokens.push({ text, kind: /\s/.test(text) ? undefined : "punctuation" });
  }
  return tokens;
}

function classifyCWord(word: string, line: string, index: number): TokenKind | undefined {
  const next = line.slice(index + word.length);
  const previous = line.slice(0, index);
  if (cTypes.has(word)) return "type";
  if (cKeywords.has(word)) return "keyword";
  if (word === "true" || word === "false") return "constant";
  if (/^[A-Z][A-Z0-9_]+$/.test(word)) return "constant";
  if (/^[A-Z]/.test(word)) return "type";
  if (/^\s*\(/.test(next)) return "function";
  if (previous.endsWith(".")) return "property";
  return undefined;
}

function highlightMarkdown(line: string): Token[] {
  if (/^#{1,6}\s/.test(line)) return [{ text: line, kind: "title" }];
  const tokens: Token[] = [];
  let rest = line;
  const marker = /^(\s*[-*]\s)/.exec(rest);
  if (marker?.[1]) {
    tokens.push({ text: marker[1], kind: "marker" });
    rest = rest.slice(marker[1].length);
  }
  const pattern = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\[[^\]]+\])(\([^)]+\))|([^`*[]+|[`*[])/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(rest))) {
    const [text, code, strong, linkText, linkUrl] = match;
    if (code) tokens.push({ text, kind: "literal" });
    else if (strong) tokens.push({ text, kind: "emphasis" });
    else if (linkText && linkUrl) tokens.push({ text: linkText, kind: "link" }, { text: linkUrl, kind: "attribute" });
    else tokens.push({ text });
  }
  return tokens;
}

export function highlight(line: string, language: Language): Token[] {
  return language === "markdown" ? highlightMarkdown(line) : highlightC(line);
}
export interface OutlineItem {
  label: string;
  line: number;
  depth: number;
}
export function outline(file: MockFile): OutlineItem[] {
  const items: OutlineItem[] = [];
  file.code.split("\n").forEach((text, line) => {
    if (file.language === "markdown") {
      const match = /^(#{1,6})\s+(.*)$/.exec(text);
      if (match?.[1] && match[2]) items.push({ label: match[2], line, depth: match[1].length - 1 });
    } else {
      const match = /^\s*(?:[\w:*&<>]+\s+)+([A-Za-z_]\w*)\s*\([^;]*\)\s*\{/.exec(text);
      if (match?.[1]) items.push({ label: `${match[1]}()`, line, depth: 0 });
    }
  });
  return items;
}
export function fileName(path: string) {
  return path.slice(path.lastIndexOf("/") + 1);
}
export function folderIcon(name: string) {
  return `${BASE_PATH}/line-ui/${name === "练习" ? "file-folder-orange-code" : "file-folder"}.svg`;
}
export function fileIcon(path: string) {
  return `${BASE_PATH}/line-ui/${path.endsWith(".cpp") ? "file-cpp" : path.endsWith(".c") ? "file-c" : "file-markdown"}.svg`;
}
export function languageName(language: Language) {
  return { c: "C", cpp: "C++", markdown: "Markdown" }[language];
}

export function searchFiles(query: string, matchCase = false, wholeWord = false) {
  const needle = matchCase ? query.trim() : query.trim().toLowerCase();
  if (!needle) return [];
  return files
    .map((file) => ({
      file,
      matches: file.code.split("\n").flatMap((line, index) => {
        const text = matchCase ? line : line.toLowerCase();
        let column = text.indexOf(needle);
        while (column >= 0) {
          const previous = text[column - 1] ?? "";
          const next = text[column + needle.length] ?? "";
          if (!wholeWord || (!/[\p{L}\p{N}_]/u.test(previous) && !/[\p{L}\p{N}_]/u.test(next)))
            return [{ line, index, column }];
          column = text.indexOf(needle, column + 1);
        }
        return [];
      }),
    }))
    .filter((result) => result.matches.length > 0);
}
