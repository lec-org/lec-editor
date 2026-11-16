// SPDX-License-Identifier: GPL-3.0-or-later
// 改编自 dstrml/wu 的 WuWindow.tsx，来源提交与原作者见 website/NOTICE.md。
// 2026-11-16：保留窗口、文件树、搜索与代码行交互，替换 Line 内容并接入预设运行和调试。
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { BASE_PATH } from "../data/release";
import {
  fileByPath,
  fileIcon,
  fileName,
  files,
  folderIcon,
  highlight,
  initiallyExpanded,
  languageName,
  outline,
  tree,
  searchFiles,
  type MockFile,
  type TokenKind,
  type TreeNode,
} from "./lineWindowData";

type PanelKey = "explorer" | "search" | "outline" | "debug";
const WIDTH = 1440;
const HEIGHT = 900;
const LINE_HEIGHT = 24;
const PANEL_WIDTH = 260;
const CHAR_WIDTH = 9;
const GUTTER_ICON_AREA = 26;
const GUTTER_FOLD_AREA = 26;
const text = "#f0eef4";
const muted = "#aaa8b7";
const placeholder = "#727080";
const accent = "#7aa2f7";

const tokenStyles: Record<TokenKind, CSSProperties> = {
  keyword: { color: "#8b7cf6" },
  type: { color: "#c084fc" },
  function: { color: "#60a5fa" },
  string: { color: "#34d399" },
  number: { color: "#facc15" },
  comment: { color: "#92929a", fontStyle: "italic" },
  property: { color: "#f472b6" },
  punctuation: { color: "#a1a1aa" },
  self: { color: "#8b7cf6" },
  constant: { color: "#facc15" },
  attribute: { color: "#22d3ee" },
  title: { color: "#8b7cf6" },
  emphasis: { color: "#facc15" },
  link: { color: "#60a5fa", fontStyle: "italic" },
  marker: { color: "#f472b6" },
  literal: { color: "#34d399" },
};

const hover = "hover:bg-[#ffffff1c]";
const panels: { key: PanelKey; icon: string; label: string }[] = [
  { key: "explorer", icon: "activity_explorer", label: "文件面板" },
  { key: "search", icon: "activity_search", label: "搜索" },
  { key: "outline", icon: "activity_outline", label: "大纲面板" },
  { key: "debug", icon: "activity_debug", label: "调试面板" },
];
function IconButton({
  name,
  label,
  onClick,
  disabled = false,
  pressed,
  size = 16,
  box = 24,
  color = text,
}: {
  name: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  pressed?: boolean;
  size?: number;
  box?: number;
  color?: string;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className={`grid shrink-0 place-items-center rounded-[4px] ${hover} disabled:cursor-default disabled:opacity-35 ${pressed ? "bg-[#7aa2f730]" : ""}`}
      style={{ width: box, height: box }}
    >
      <Icon name={name} size={size} color={color} />
    </button>
  );
}

function Icon({
  name,
  size = 16,
  color,
  className = "",
}: {
  name: string;
  size?: number;
  color?: string;
  className?: string;
}) {
  const mask = `url(${BASE_PATH}/line-ui/${name}.svg) center / contain no-repeat`;
  return (
    <span
      aria-hidden="true"
      className={`inline-block shrink-0 bg-current ${className}`}
      style={{ width: size, height: size, mask, WebkitMask: mask, color }}
    />
  );
}

function ImageIcon({ src, size = 16, className = "" }: { src: string; size?: number; className?: string }) {
  return <img src={src} alt="" width={size} height={size} className={`shrink-0 ${className}`} draggable={false} />;
}

function Highlighted({ code, language }: { code: string; language: MockFile["language"] }) {
  return (
    <>
      {highlight(code, language).map((token, index) => (
        <span key={index} style={token.kind ? tokenStyles[token.kind] : undefined}>
          {token.text}
        </span>
      ))}
    </>
  );
}

function indentLevels(lines: string[]) {
  const levels = lines.map((line) => (line.trim() ? Math.floor((line.length - line.trimStart().length) / 4) : -1));
  return levels.map((level, index) => {
    if (level >= 0) return level;
    const before = levels.slice(0, index).findLast((value) => value >= 0) ?? 0;
    const after = levels.slice(index + 1).find((value) => value >= 0) ?? 0;
    return Math.min(before, after);
  });
}

function symbolPath(file: MockFile, line: number) {
  const path: string[] = [];
  for (const item of outline(file)) {
    if (item.line > line) break;
    path.length = item.depth;
    path[item.depth] = item.label;
  }
  return path.filter(Boolean);
}

function Editor({
  file,
  cursor,
  revealToken,
  onCursor,
  breakpoints,
  onBreakpoint,
  executionLine,
}: {
  file: MockFile;
  cursor: { line: number; column: number };
  revealToken: number;
  onCursor: (line: number, column: number) => void;
  breakpoints: number[];
  onBreakpoint: (line: number) => void;
  executionLine: number | null;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const lines = file.code.split("\n");
  const levels = indentLevels(lines);
  const digits = Math.max(3, String(file.firstLine + lines.length - 1).length);
  const gutterWidth = GUTTER_ICON_AREA + digits * CHAR_WIDTH + GUTTER_FOLD_AREA;

  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    const top = cursor.line * LINE_HEIGHT;
    if (top < scroller.scrollTop || top > scroller.scrollTop + scroller.clientHeight - LINE_HEIGHT * 3) {
      scroller.scrollTop = Math.max(0, top - scroller.clientHeight / 3);
    }
    // 单击代码行只移动光标；从搜索或大纲跳转时才自动滚动。
  }, [revealToken, file.path]);

  return (
    <div
      ref={scrollRef}
      id="line-code-panel"
      role="tabpanel"
      aria-label={`${fileName(file.path)} 代码预览`}
      className="min-h-0 flex-1 overflow-auto overscroll-contain bg-[#181a21] font-line-mono text-[15px]"
    >
      {lines.map((line, index) => {
        const isActive = index === cursor.line;
        const isExecuting = executionLine === index;
        return (
          <div
            key={index}
            className={`relative flex cursor-text ${isExecuting ? "bg-[#e6c38420]" : isActive ? "bg-[#ffffff08]" : ""}`}
            style={{ height: LINE_HEIGHT, lineHeight: `${LINE_HEIGHT}px` }}
            onMouseDown={() => onCursor(index, line.length + 1)}
          >
            <button
              type="button"
              className="relative shrink-0 text-right select-none hover:bg-[#ffffff0a]"
              style={{ width: gutterWidth, paddingRight: GUTTER_FOLD_AREA, color: isActive ? text : "#727080" }}
              aria-label={`第 ${file.firstLine + index} 行断点`}
              aria-pressed={breakpoints.includes(index)}
              disabled={file.language === "markdown" || !line.trim()}
              onMouseDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                onBreakpoint(index);
              }}
            >
              {breakpoints.includes(index) && (
                <span className="absolute left-3 text-[#f28b91]" aria-hidden="true">
                  ●
                </span>
              )}
              {isExecuting && (
                <span className="absolute left-0 text-[#e6c384]" aria-hidden="true">
                  →
                </span>
              )}
              {file.firstLine + index}
            </button>
            <span className="relative whitespace-pre" style={{ color: text }}>
              {Array.from({ length: levels[index] ?? 0 }, (_, level) => (
                <span
                  key={level}
                  aria-hidden="true"
                  className="absolute inset-y-0 w-px bg-[#ffffff0f]"
                  style={{ left: `${level * 4}ch` }}
                />
              ))}
              <Highlighted code={line} language={file.language} />
              {isActive && (
                <span
                  className="inline-block h-6 w-[2px] animate-blink align-top motion-reduce:animate-none"
                  style={{ background: text }}
                />
              )}
            </span>
            {isExecuting && <span className="pl-12 text-[12px] whitespace-pre text-[#e6c384]">← 当前执行位置</span>}
          </div>
        );
      })}
      <div style={{ height: LINE_HEIGHT * 8 }} />
    </div>
  );
}

export function LineWindow() {
  const [panel, setPanel] = useState<PanelKey | null>("explorer");
  const [expanded, setExpanded] = useState(() => new Set(initiallyExpanded));
  const [tabs, setTabs] = useState(["main.c", "练习/问候.cpp"]);
  const tabButtons = useRef<Record<string, HTMLButtonElement | null>>({});
  const [activePath, setActivePath] = useState<string | null>("main.c");
  const [cursors, setCursors] = useState<Record<string, { line: number; column: number }>>({
    "main.c": { line: 8, column: 5 },
  });
  const [revealToken, setRevealToken] = useState(0);
  const [query, setQuery] = useState("value");
  const [matchCase, setMatchCase] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [outlineQuery, setOutlineQuery] = useState("");
  const [terminalOpen, setTerminalOpen] = useState(true);
  const [runState, setRunState] = useState<"ready" | "compiling" | "finished" | "stopped">("ready");
  const [output, setOutput] = useState("点击右上角「运行演示」，看看程序的输出。");
  const [runFile, setRunFile] = useState("main.c");
  const runTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [breakpoints, setBreakpoints] = useState<Record<string, number[]>>({ "main.c": [8] });
  const [debug, setDebug] = useState<{ path: string; index: number; state: "paused" | "finished" } | null>(null);
  const activeFile = activePath ? fileByPath.get(activePath) : undefined;
  const cursor = activeFile ? (cursors[activeFile.path] ?? { line: 0, column: 1 }) : undefined;
  const debugFile = debug ? fileByPath.get(debug.path) : undefined;
  const debugStep = debugFile?.steps?.[debug?.index ?? 0];
  const executionLine = debug?.state === "paused" && debug.path === activePath ? (debugStep?.line ?? null) : null;
  const searchResults = searchFiles(query, matchCase, wholeWord);
  useEffect(() => () => clearTimeout(runTimer.current), []);

  function openFile(path: string, line?: number, column = 1) {
    if (!fileByPath.has(path)) return;
    setTabs((current) => (current.includes(path) ? current : [...current, path]));
    setActivePath(path);
    if (line !== undefined) {
      setCursors((current) => ({ ...current, [path]: { line, column } }));
      setRevealToken((value) => value + 1);
    }
  }
  function closeTab(path: string) {
    const index = tabs.indexOf(path);
    const remaining = tabs.filter((existing) => existing !== path);
    setTabs(remaining);
    if (activePath === path) setActivePath(remaining[Math.min(index, remaining.length - 1)] ?? null);
  }
  function toggleBreakpoint(line: number) {
    if (!activeFile || activeFile.language === "markdown") return;
    const path = activeFile.path;
    setBreakpoints((current) => {
      const entries = current[path] ?? [];
      return {
        ...current,
        [path]: entries.includes(line)
          ? entries.filter((value) => value !== line)
          : [...entries, line].sort((left, right) => left - right),
      };
    });
  }
  function stopRun() {
    clearTimeout(runTimer.current);
    setRunState("stopped");
    setOutput("演示已停止。");
    setDebug(null);
  }
  function runExample() {
    if (!activeFile?.output) return;
    clearTimeout(runTimer.current);
    setDebug(null);
    setRunFile(activeFile.path);
    setTerminalOpen(true);
    setRunState("compiling");
    setOutput("正在演示编译运行过程…");
    const result = activeFile.output;
    runTimer.current = setTimeout(
      () => {
        setOutput(result);
        setRunState("finished");
      },
      matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 650,
    );
  }
  function showDebugStep(path: string, index: number) {
    const file = fileByPath.get(path);
    const step = file?.steps?.[index];
    if (!step) return;
    setDebug({ path, index, state: "paused" });
    openFile(path, step.line, 5);
    if (step.output) {
      setOutput(step.output);
      setTerminalOpen(true);
      setRunFile(path);
    }
  }
  function startDebug() {
    if (!activeFile?.steps?.length) return;
    clearTimeout(runTimer.current);
    setRunState("ready");
    setRunFile(activeFile.path);
    setTerminalOpen(true);
    setPanel("debug");
    setOutput("调试演示已启动，观察左侧的局部变量。");
    const firstBreakpoint = (breakpoints[activeFile.path] ?? [])[0];
    const index =
      firstBreakpoint === undefined ? 0 : activeFile.steps.findIndex((step) => step.line >= firstBreakpoint);
    showDebugStep(activeFile.path, Math.max(0, index));
  }
  function advanceDebug(continueToBreakpoint = false) {
    if (!debug || debug.state !== "paused" || !debugFile?.steps) return;
    const nextIndex = continueToBreakpoint
      ? debugFile.steps.findIndex(
          (step, index) => index > debug.index && (breakpoints[debug.path] ?? []).includes(step.line),
        )
      : debug.index + 1;
    if (nextIndex >= 0 && nextIndex < debugFile.steps.length) showDebugStep(debug.path, nextIndex);
    else {
      setDebug({ ...debug, state: "finished" });
      setRunFile(debug.path);
      setOutput(debugFile.output ?? "");
      setRunState("finished");
      setTerminalOpen(true);
    }
  }
  const toggleFolder = (path: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });

  const indentGuides = (depth: number) =>
    Array.from({ length: depth }, (_, level) => (
      <span
        key={level}
        aria-hidden="true"
        className="absolute inset-y-0 w-px bg-[#fefef31b]"
        style={{ left: level * 20 + 15 }}
      />
    ));

  const renderTree = (node: TreeNode, depth: number): ReactNode => {
    const rowClass =
      "relative flex h-6 w-full cursor-pointer items-center gap-1.5 border border-transparent pr-[2px] text-left text-[14px]";
    if (typeof node === "string") {
      const isMarked = activeFile?.path === node;
      const color = isMarked ? text : muted;
      return (
        <button
          key={node}
          type="button"
          className={`${rowClass} ${isMarked ? "bg-[#7aa2f72e]" : hover}`}
          style={{ paddingLeft: 6 + depth * 20, color }}
          onClick={() => openFile(node)}
        >
          {indentGuides(depth)}
          <ImageIcon src={fileIcon(node)} />
          <span className="truncate">{fileName(node)}</span>
        </button>
      );
    }
    const isOpen = expanded.has(node.path);
    return (
      <div key={node.path || "root"}>
        <button
          type="button"
          className={`${rowClass} ${hover}`}
          style={{ paddingLeft: 6 + depth * 20, color: muted }}
          aria-expanded={isOpen}
          onClick={() => toggleFolder(node.path)}
        >
          {indentGuides(depth)}
          <ImageIcon src={folderIcon(node.name)} />
          <span className="truncate">{node.name}</span>
        </button>
        {isOpen && node.children.map((child) => renderTree(child, depth + 1))}
      </div>
    );
  };

  const renderSidebar = () => {
    switch (panel) {
      case "explorer":
        return <div className="min-h-0 flex-1 overflow-auto overscroll-contain pb-8">{renderTree(tree, 0)}</div>;
      case "search": {
        const needle = query.trim();
        const matchCount = searchResults.reduce((count, result) => count + result.matches.length, 0);
        return (
          <>
            <div className="flex gap-1 px-2 pt-2 pb-1">
              <span className={`grid w-4 shrink-0 place-items-center rounded-[4px] ${hover}`}>
                <Icon name="chevron_right" size={14} color={muted} />
              </span>
              <div className="flex h-7 min-w-0 flex-1 items-center gap-1 rounded-[6px] border border-[#23262f] bg-[#181a21] pr-0.5 pl-2 focus-within:border-[#7aa2f7b2]">
                <input
                  className="min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-[#727080]"
                  style={{ color: text }}
                  placeholder={"搜索代码…"}
                  aria-label={"搜索示例项目"}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
                <IconButton
                  name="case_sensitive"
                  box={24}
                  label="区分大小写"
                  pressed={matchCase}
                  onClick={() => setMatchCase((value) => !value)}
                />
                <IconButton
                  name="whole_word"
                  box={24}
                  label="全字匹配"
                  pressed={wholeWord}
                  onClick={() => setWholeWord((value) => !value)}
                />
              </div>
            </div>
            <div className="flex h-7 shrink-0 items-center gap-2 border-b border-[#23262f] pr-1 pl-2">
              <span className="flex-1 truncate text-[12px]" style={{ color: muted }}>
                {needle ? `${searchResults.length} 个文件，${matchCount} 行结果` : "输入关键词搜索示例代码"}
              </span>
              <IconButton name="close" box={22} label="清空搜索" onClick={() => setQuery("")} />
            </div>
            <div className="min-h-0 flex-1 overflow-auto overscroll-contain pt-0.5">
              {searchResults.map(({ file, matches }) => (
                <div key={file.path}>
                  <div className="flex h-[23px] items-center gap-1.5 border-l-2 border-transparent pr-2 pl-1.5">
                    <ImageIcon src={fileIcon(file.path)} size={14} />
                    <span className="shrink-0 text-[14px]" style={{ color: text }}>
                      {fileName(file.path)}
                    </span>
                    <span className="min-w-0 truncate text-[12px]" style={{ color: muted }}>
                      {file.path.includes("/") ? file.path.slice(0, file.path.lastIndexOf("/")) : ""}
                    </span>
                    <span className="ml-auto rounded-full bg-[#2a2d37] px-1.5 text-[10px]" style={{ color: muted }}>
                      {matches.length}
                    </span>
                  </div>
                  {matches.map((match) => {
                    const leading = match.line.length - match.line.trimStart().length;
                    const start = match.column - leading;
                    const trimmed = match.line.trimStart();
                    return (
                      <button
                        key={match.index}
                        type="button"
                        className={`flex h-[23px] w-full cursor-pointer items-center border-l-2 border-transparent pr-2 pl-7 text-left text-[12px] ${hover}`}
                        style={{ color: muted }}
                        onClick={() => openFile(file.path, match.index, match.column + 1)}
                      >
                        <span className="truncate whitespace-pre">
                          {trimmed.slice(0, start)}
                          <span className="bg-[#7aa2f74c]" style={{ color: text }}>
                            {trimmed.slice(start, start + needle.length)}
                          </span>
                          {trimmed.slice(start + needle.length)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ))}
              {needle && searchResults.length === 0 && (
                <p className="px-5 py-8 text-center text-[13px] text-[#aaa8b7]">没有找到匹配的代码</p>
              )}
            </div>
          </>
        );
      }
      case "outline": {
        const items = activeFile
          ? outline(activeFile).filter((item) => item.label.toLowerCase().includes(outlineQuery.toLowerCase()))
          : [];
        return (
          <>
            <div className="flex h-8 shrink-0 items-center gap-2 border-b border-[#2c2f3a] px-2">
              <Icon name="magnifying_glass" size={14} color={muted} />
              <input
                className="min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-[#727080]"
                placeholder="搜索当前文件符号…"
                aria-label="搜索大纲"
                value={outlineQuery}
                onChange={(event) => setOutlineQuery(event.target.value)}
              />
            </div>
            <div className="min-h-0 flex-1 overflow-auto overscroll-contain">
              {activeFile &&
                items.map((item, index) => {
                  const hasChildren = (items[index + 1]?.depth ?? 0) > item.depth;
                  const isActive = cursor ? symbolPath(activeFile, cursor.line).at(-1) === item.label : false;
                  return (
                    <button
                      key={`${item.line}:${item.label}`}
                      type="button"
                      className={`flex h-[26px] w-full cursor-pointer items-center gap-1 border border-transparent pr-[2px] text-left ${isActive ? "bg-[#7aa2f72e]" : hover}`}
                      style={{ paddingLeft: 6 + item.depth * 20 }}
                      onClick={() => openFile(activeFile.path, item.line, 1)}
                    >
                      <span className="grid w-4 shrink-0 place-items-center">
                        {hasChildren && <Icon name="chevron_down" size={14} color={muted} />}
                      </span>
                      <span className="truncate font-line-mono text-[15px] leading-none" style={{ color: text }}>
                        {item.label}
                      </span>
                    </button>
                  );
                })}
              {items.length === 0 && <p className="px-5 py-8 text-center text-[13px] text-[#aaa8b7]">没有匹配的符号</p>}
            </div>
          </>
        );
      }
      case "debug":
        return (
          <>
            <div className="flex h-10 shrink-0 items-center gap-1 border-b border-[#2c2f3a] px-2">
              <IconButton
                name="agent_arrow_right"
                label="开始调试演示"
                onClick={startDebug}
                disabled={!activeFile?.steps}
                color="#91b78e"
              />
              <IconButton
                name="agent_arrow_down"
                label="单步执行演示"
                onClick={() => advanceDebug()}
                disabled={debug?.state !== "paused"}
              />
              <IconButton
                name="expand_down"
                label="继续执行演示"
                onClick={() => advanceDebug(true)}
                disabled={debug?.state !== "paused"}
              />
              <IconButton name="close" label="停止调试演示" onClick={stopRun} disabled={!debug} />
              <span className="ml-auto text-[11px] text-[#aaa8b7]">
                {debug?.state === "paused" ? "已暂停" : debug?.state === "finished" ? "已结束" : "尚未启动"}
              </span>
            </div>
            {!debug && (
              <div className="flex h-36 shrink-0 flex-col items-center justify-center gap-3 text-[13px]">
                <button
                  className={`flex items-center gap-2 rounded px-3 py-1.5 ${hover}`}
                  onClick={startDebug}
                  disabled={!activeFile?.steps}
                >
                  <Icon name="plus" />
                  调试当前文件
                </button>
                <span className="text-[11px] text-[#aaa8b7]">点击行号设置或取消断点</span>
              </div>
            )}
            {debug && (
              <>
                <div className="border-b border-[#2c2f3a] px-3 py-2 text-[12px] text-[#aaa8b7]">调用堆栈</div>
                <button
                  className={`mx-1 my-1 rounded px-3 py-2 text-left ${hover}`}
                  onClick={() => openFile(debug.path, debugStep?.line ?? 0, 5)}
                >
                  <span className="block text-[14px]">main()</span>
                  <span className="text-[11px] text-[#aaa8b7]">
                    {fileName(debug.path)}:{(debugStep?.line ?? 0) + 1}
                  </span>
                </button>
                <div className="border-y border-[#2c2f3a] px-3 py-2 text-[12px] text-[#aaa8b7]">局部变量</div>
                <div className="min-h-24 px-4 py-2 font-line-mono text-[13px]" aria-live="polite">
                  {Object.entries(debugStep?.variables ?? {}).map(([name, value]) => (
                    <div key={name} className="flex justify-between py-1.5">
                      <span>{name}</span>
                      <span className="text-[#e6c384]">{value}</span>
                    </div>
                  ))}
                  {Object.keys(debugStep?.variables ?? {}).length === 0 && (
                    <span className="text-[12px] text-[#aaa8b7]">变量尚未初始化</span>
                  )}
                </div>
              </>
            )}
            <div className="border-y border-[#2c2f3a] px-3 py-2 text-[12px] text-[#aaa8b7]">断点</div>
            <div className="min-h-0 flex-1 overflow-auto py-1">
              {Object.entries(breakpoints).flatMap(([path, lines]) =>
                lines.map((line) => (
                  <button
                    key={`${path}:${line}`}
                    className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12px] ${hover}`}
                    onClick={() => openFile(path, line, 1)}
                  >
                    <span className="text-[#f28b91]">●</span>
                    {fileName(path)}
                    <span className="ml-auto text-[#aaa8b7]">第 {line + 1} 行</span>
                  </button>
                )),
              )}
              {Object.values(breakpoints).every((lines) => lines.length === 0) && (
                <p className="p-4 text-[12px] text-[#aaa8b7]">尚未设置断点</p>
              )}
            </div>
          </>
        );
      case null:
        return null;
    }
  };

  const symbols = activeFile && cursor ? symbolPath(activeFile, cursor.line) : [];
  return (
    <div
      className="line-window flex flex-col overflow-hidden bg-[#181a21] font-line text-[14px] font-[350] tracking-normal select-none"
      style={{ width: WIDTH, height: HEIGHT, color: text }}
    >
      <div className="relative flex h-[34px] shrink-0 items-center gap-2 pl-[76px] text-[12px]">
        <span className="absolute top-1/2 left-[13px] flex -translate-y-1/2 gap-2" aria-hidden="true">
          <span className="size-3 rounded-full bg-[#ff5f57]" />
          <span className="size-3 rounded-full bg-[#febc2e]" />
          <span className="size-3 rounded-full bg-[#28c840]" />
        </span>
        <img src={`${BASE_PATH}/line.png`} alt="" width={16} height={16} className="rounded" />
        <span>Line</span>
        <span className="text-[#aaa8b740]">/</span>
        <span className="text-[#aaa8b7]">C语言练习</span>
        <span className="ml-auto pr-3 text-[11px] text-[#727080]">交互预览 · 预设示例</span>
      </div>
      <div className="flex min-h-0 flex-1 border-y border-[#2c2f3a]">
        <div className="flex w-12 shrink-0 flex-col items-center gap-2 border-r border-[#2c2f3a] py-1">
          {panels.map((item) => (
            <button
              key={item.key}
              type="button"
              aria-label={item.label}
              title={item.label}
              aria-pressed={panel === item.key}
              className={`relative grid size-10 place-items-center rounded-[4px] ${hover} active:bg-[#ffffff29]`}
              style={{ color: panel === item.key ? accent : text }}
              onClick={() => setPanel(panel === item.key ? null : item.key)}
            >
              <Icon name={item.icon} size={24} />
            </button>
          ))}
          <button
            type="button"
            aria-label="切换终端面板"
            title="切换终端面板"
            aria-pressed={terminalOpen}
            className={`mt-auto grid size-10 place-items-center rounded-[4px] ${hover}`}
            onClick={() => setTerminalOpen((value) => !value)}
          >
            <Icon name="terminal_alt" size={24} />
          </button>
        </div>
        {panel && (
          <div className="flex shrink-0 flex-col border-r border-[#2c2f3a]" style={{ width: PANEL_WIDTH }}>
            {renderSidebar()}
          </div>
        )}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex h-9 shrink-0 items-center border-b border-[#23262f]">
            <div
              className="flex min-w-0 flex-1 items-center gap-1 overflow-auto px-1"
              role="tablist"
              aria-label="示例文件"
            >
              {tabs.map((path) => {
                const isActive = path === activePath;
                return (
                  <div
                    key={path}
                    className={`group/tab flex h-7 max-w-[240px] shrink-0 items-center gap-[3px] rounded-[6px] px-1 text-[14px] ${isActive ? "bg-[#22252e]" : "hover:bg-[#ebebeb10]"}`}
                    style={{ color: isActive ? text : muted }}
                  >
                    <button
                      role="tab"
                      type="button"
                      aria-selected={isActive}
                      aria-controls="line-code-panel"
                      tabIndex={isActive ? 0 : -1}
                      ref={(element) => {
                        tabButtons.current[path] = element;
                      }}
                      onKeyDown={(event) => {
                        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
                        event.preventDefault();
                        const nextIndex =
                          (tabs.indexOf(path) + (event.key === "ArrowLeft" ? -1 : 1) + tabs.length) % tabs.length;
                        const next = tabs[nextIndex];
                        if (next) {
                          setActivePath(next);
                          tabButtons.current[next]?.focus();
                        }
                      }}
                      className="flex min-w-0 items-center gap-1.5 px-1 py-0.5"
                      onClick={() => setActivePath(path)}
                    >
                      <ImageIcon src={fileIcon(path)} size={14} />
                      <span className="truncate">{fileName(path)}</span>
                    </button>
                    <button
                      type="button"
                      aria-label={`关闭 ${fileName(path)}`}
                      className={`grid size-[18px] place-items-center rounded-[4px] opacity-0 group-hover/tab:opacity-100 group-focus-within/tab:opacity-100 ${hover}`}
                      onClick={() => closeTab(path)}
                    >
                      <Icon name="close" size={14} color={muted} />
                    </button>
                  </div>
                );
              })}
            </div>
            <div className="px-1.5">
              <IconButton
                name="plus"
                label="打开下一个示例"
                onClick={() => openFile(files.find((file) => !tabs.includes(file.path))?.path ?? "main.c")}
              />
            </div>
          </div>
          {activeFile && cursor ? (
            <>
              <div className="flex h-[45px] shrink-0 items-center gap-2 border-b border-[#23262f] bg-[#181a21] px-2 py-1.5">
                <span
                  className="flex min-w-0 flex-1 items-center gap-1 px-1 font-line-mono text-[13px]"
                  style={{ color: muted }}
                >
                  <span className="truncate">{activeFile.path}</span>
                  {symbols.map((symbol) => (
                    <span key={symbol} className="flex shrink-0 items-center gap-1">
                      <span className="px-1 text-[#727080]">›</span>
                      {symbol}
                    </span>
                  ))}
                </span>
                <button
                  type="button"
                  className={`flex h-7 shrink-0 items-center gap-1.5 rounded px-2 text-[13px] text-[#a3be8c] ${hover} disabled:opacity-40`}
                  id="run-demo"
                  onClick={runExample}
                  disabled={!activeFile.output || runState === "compiling"}
                >
                  <Icon name="agent_arrow_right" size={17} color="#a3be8c" />
                  <span>{runState === "compiling" ? "编译中…" : "运行演示"}</span>
                </button>
                {runState === "compiling" && <IconButton name="close" label="停止运行演示" onClick={stopRun} />}
                <IconButton
                  name="magnifying_glass"
                  label="搜索当前示例"
                  onClick={() => {
                    setPanel("search");
                    setQuery("");
                  }}
                />
                <IconButton name="activity_outline" label="查看当前文件大纲" onClick={() => setPanel("outline")} />
              </div>
              <Editor
                file={activeFile}
                cursor={cursor}
                revealToken={revealToken}
                onCursor={(line, column) =>
                  setCursors((current) => ({ ...current, [activeFile.path]: { line, column } }))
                }
                breakpoints={breakpoints[activeFile.path] ?? []}
                onBreakpoint={toggleBreakpoint}
                executionLine={executionLine}
              />
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-4">
              <img src={`${BASE_PATH}/line.png`} alt="" width={72} height={72} className="rounded-2xl" />
              <p className="text-[#aaa8b7]">从左侧打开一份文件，开始探索。</p>
              <button className={`rounded px-4 py-2 ${hover}`} onClick={() => openFile("main.c")}>
                打开 main.c
              </button>
            </div>
          )}
          {terminalOpen && (
            <div className="flex h-[192px] shrink-0 flex-col border-t border-[#2c2f3a] bg-[#181a21]">
              <div className="flex h-9 shrink-0 items-center gap-2 border-b border-[#23262f] px-3 text-[12px]">
                <Icon name="terminal_alt" size={15} />
                <span>运行结果</span>
                <span className="ml-2 text-[#727080]">{runFile}</span>
                <span className="ml-auto text-[11px] text-[#727080]">Zig · C / C++</span>
                <IconButton name="close" label="关闭终端" onClick={() => setTerminalOpen(false)} />
              </div>
              <div
                className="min-h-0 flex-1 overflow-auto px-5 py-3 font-line-mono text-[13px] leading-[1.8]"
                aria-live="polite"
              >
                <p className="text-[#aaa8b7]" id="terminal-command">
                  {runState === "compiling" ? `正在编译 ${runFile}…` : `❯ 编译运行 ${runFile}`}
                </p>
                <p className="whitespace-pre-wrap text-[#f0eef4]" id="terminal-result">
                  {output}
                </p>
                <p className="text-[12px] text-[#91b78e]" id="terminal-status">
                  {runState === "finished"
                    ? "✓ 程序已结束，退出代码 0"
                    : runState === "compiling"
                      ? "正在演示编译运行过程"
                      : "网页演示使用预设数据，不会编译或保存代码"}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="flex h-[30px] shrink-0 items-center justify-between gap-2 px-3 text-[12px]">
        <span className="flex items-center gap-2 text-[#aaa8b7]">
          <Icon name="check" size={15} />
          工具链已就绪<span className="ml-2 text-[#727080]">交互演示</span>
        </span>
        <span className="flex items-center gap-3 text-[#aaa8b7]">
          {activeFile && cursor && (
            <>
              <span>
                {activeFile.firstLine + cursor.line}:{cursor.column}
              </span>
              <span>{languageName(activeFile.language)}</span>
            </>
          )}
          <span>UTF-8</span>
          <IconButton
            name="terminal_alt"
            label="显示或隐藏终端"
            pressed={terminalOpen}
            onClick={() => setTerminalOpen((value) => !value)}
          />
        </span>
      </div>
    </div>
  );
}

export function LineWindowFrame() {
  return (
    <div className="editor-stage" id="experience">
      <div className="editor-halo" aria-hidden="true" />
      <div className="line-window-frame @container relative aspect-[16/10] overflow-hidden rounded-xl border border-[#ffffff29] shadow-2xl">
        <div
          className="absolute top-0 left-0 origin-top-left"
          style={{ width: WIDTH, height: HEIGHT, scale: `tan(atan2(100cqw, ${WIDTH}px))` }}
        >
          <LineWindow />
        </div>
      </div>
      <div className="editor-caption">
        <span>可交互预览 · 点击文件、搜索，或点行号设置断点</span>
        <span>
          <a href="https://github.com/dstrml/wu/blob/2c22e1da77dbbe4b1eb668eb56a43d3de8e73aa3/website/src/components/WuWindow.tsx">
            基于 Wu 开源组件改编 ↗
          </a>{" "}
          · 运行与调试使用预设数据
        </span>
      </div>
    </div>
  );
}
