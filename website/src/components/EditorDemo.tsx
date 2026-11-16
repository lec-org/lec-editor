import { useEffect, useRef, useState } from "react";
import { BASE_PATH } from "../data/release";

// 高亮 HTML 只来自内置示例，不能在此入口拼接用户输入。
const examples = {
  c: [
    '<span class="syntax-purple">#include</span> <span class="syntax-green">&lt;stdio.h&gt;</span>',
    "",
    '<span class="syntax-purple">int</span> <span class="syntax-blue">main</span>(<span class="syntax-purple">void</span>) {',
    '    <span class="syntax-blue">printf</span>(<span class="syntax-green">"Hello, Line!\\n"</span>);',
    '    <span class="syntax-purple">return</span> <span class="syntax-orange">0</span>;',
    "}",
  ],
  cpp: [
    '<span class="syntax-purple">#include</span> <span class="syntax-green">&lt;iostream&gt;</span>',
    "",
    '<span class="syntax-purple">int</span> <span class="syntax-blue">main</span>() {',
    '    std::<span class="syntax-blue">cout</span> &lt;&lt; <span class="syntax-green">"Hello, Line!"</span> &lt;&lt; std::endl;',
    '    <span class="syntax-purple">return</span> <span class="syntax-orange">0</span>;',
    "}",
  ],
};
const debugCode = [
  "int main(void) {",
  "    int value = 1;",
  "    value += 2;",
  '    printf("%d\\n", value);',
  "    return 0;",
  "}",
];

export function EditorDemo() {
  const [language, setLanguage] = useState<"c" | "cpp">("c");
  const [compiling, setCompiling] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const tabs = useRef<Record<"c" | "cpp", HTMLButtonElement | null>>({ c: null, cpp: null });
  useEffect(() => () => clearTimeout(timer.current), []);
  function changeLanguage(next: "c" | "cpp") {
    clearTimeout(timer.current);
    setCompiling(false);
    setLanguage(next);
  }
  function runExample() {
    clearTimeout(timer.current);
    setCompiling(true);
    timer.current = setTimeout(
      () => setCompiling(false),
      matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 700,
    );
  }
  return (
    <div className="editor-stage" id="experience">
      <div className="editor-halo" aria-hidden="true"></div>
      <div className="editor-window">
        <div className="editor-titlebar">
          <div className="traffic" aria-hidden="true">
            <i></i>
            <i></i>
            <i></i>
          </div>
          <div className="window-name">
            <img src={`${BASE_PATH}/line.png`} width="17" height="17" alt="" />
            Line <span>/</span> C语言练习
          </div>
          <span className="window-badge">C / C++</span>
        </div>
        <div className="editor-main">
          <div className="activity-bar" aria-hidden="true">
            <span className="activity-active">
              <svg viewBox="0 0 24 24">
                <path d="M8 3h7l5 5v12H8zM4 7v14h12M15 3v6h5" />
              </svg>
            </span>
            <span>
              <svg viewBox="0 0 24 24">
                <circle cx="10" cy="10" r="6" />
                <path d="m15 15 6 6" />
              </svg>
            </span>
            <span>
              <svg viewBox="0 0 24 24">
                <path d="M5 5h14M5 10h14M5 15h14M5 20h14" />
              </svg>
            </span>
            <span>
              <svg viewBox="0 0 24 24">
                <rect x="7" y="7" width="10" height="13" rx="5" />
                <path d="M9 7V4h6v3M3 10h4m10 0h4M3 16h4m10 0h4M12 8v12" />
              </svg>
            </span>
            <span className="activity-bottom">
              <svg viewBox="0 0 24 24">
                <path d="M3 3h7v7H3zm11 0h7v7h-7zM3 14h7v7H3zm11 0h7v7h-7z" />
              </svg>
            </span>
          </div>
          <aside className="editor-sidebar" aria-label="示意文件列表">
            <div className="sidebar-heading">
              文件 <span>＋</span>
            </div>
            <div className="project-folder">
              ⌄ <span className="folder-icon">▰</span> C语言练习
            </div>
            <div className="source-file active">
              <span className="c-file-icon">C</span>
              <span data-filename>main.{language}</span>
            </div>
            <div className="source-file muted">
              <span className="file-outline">◇</span> 学习笔记.txt
            </div>
            <div className="sidebar-tip">
              <span className="status-dot"></span>工具链已就绪
            </div>
          </aside>
          <div className="editor-workspace">
            <div className="editor-toolbar">
              <div role="tablist" aria-label="选择代码示例">
                <button
                  type="button"
                  role="tab"
                  id="example-c"
                  aria-controls="code-example"
                  aria-selected={language === "c"}
                  tabIndex={language === "c" ? 0 : -1}
                  data-language="c"
                  ref={(element) => {
                    tabs.current.c = element;
                  }}
                  onClick={() => changeLanguage("c")}
                  onKeyDown={(event) => {
                    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                      event.preventDefault();
                      const next = language === "c" ? "cpp" : "c";
                      changeLanguage(next);
                      tabs.current[next]?.focus();
                    }
                  }}
                >
                  main.c<span className="tab-dot"></span>
                </button>
                <button
                  type="button"
                  role="tab"
                  id="example-cpp"
                  aria-controls="code-example"
                  aria-selected={language === "cpp"}
                  tabIndex={language === "cpp" ? 0 : -1}
                  data-language="cpp"
                  ref={(element) => {
                    tabs.current.cpp = element;
                  }}
                  onClick={() => changeLanguage("cpp")}
                  onKeyDown={(event) => {
                    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                      event.preventDefault();
                      const next = language === "c" ? "cpp" : "c";
                      changeLanguage(next);
                      tabs.current[next]?.focus();
                    }
                  }}
                >
                  main.cpp
                </button>
              </div>
              <button type="button" className="run-button" id="run-demo" disabled={compiling} onClick={runExample}>
                <span aria-hidden="true">▶</span>
                <span data-run-label>{compiling ? "编译中…" : "运行演示"}</span>
                <kbd>F5</kbd>
              </button>
            </div>
            <div className="code-area" id="code-example" role="tabpanel" aria-labelledby={`example-${language}`}>
              <div className="code-breadcrumb">
                <span data-filename>main.{language}</span>
                <span>›</span>main()
              </div>
              <pre id="source-code">
                {examples[language].map((line, index) => (
                  <span key={index} className="code-line">
                    <span className="line-number" aria-hidden="true">
                      {index + 1}
                    </span>
                    <code dangerouslySetInnerHTML={{ __html: line || " " }} />
                  </span>
                ))}
              </pre>
            </div>
            <div className="terminal">
              <div className="terminal-tabs">
                <span className="terminal-active">运行结果</span>
                <span>终端</span>
                <span className="terminal-right">内置 Zig · C17 / C++17</span>
              </div>
              <div className="terminal-output" aria-live="polite" aria-atomic="true">
                <p className="terminal-command">
                  <span>❯</span>{" "}
                  <span id="terminal-command">
                    {compiling ? `正在编译 main.${language}…` : `编译运行 main.${language}`}
                  </span>
                </p>
                <p className="terminal-result" id="terminal-result">
                  {compiling ? "" : "Hello, Line!"}
                </p>
                <p className="terminal-status" id="terminal-status">
                  {compiling ? (
                    "正在预览编译运行过程"
                  ) : (
                    <>
                      <span>✓</span> 程序已结束，退出代码 0
                    </>
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>
        <div className="editor-status">
          <span>
            <span className="status-dot"></span>就绪 <span className="status-separator">│</span> 0 个错误　0 个警告
          </span>
          <span>
            UTF-8 <span className="status-separator">│</span>{" "}
            <span id="status-language">{language === "c" ? "C" : "C++"}</span>{" "}
            <span className="status-separator">│</span> 4 空格
          </span>
        </div>
      </div>
      <div className="editor-caption">
        <span>交互界面示意 · 可点击「运行演示」</span>
        <span>
          点击文件标签，切换 C / C++ <span aria-hidden="true">↗</span>
        </span>
      </div>
    </div>
  );
}

export function DebugDemo() {
  const [debugStep, setDebugStep] = useState(0);
  return (
    <section id="debugging" className="media-section debug-section" aria-labelledby="debug-title">
      <div className="media-copy reveal">
        <span className="eyebrow">看懂每一步</span>
        <h2 id="debug-title">
          程序怎么运行，
          <br />
          停下来就看明白了。
        </h2>
        <p>结果和想的不一样？设一个断点，单步执行，观察变量。运行和基础调试都在手边，不必先写配置文件。</p>
        <div className="debug-shortcuts">
          <span>
            <kbd>F6</kbd> 开始调试
          </span>
          <span>
            <kbd>F9</kbd> 切换断点
          </span>
        </div>
        <button
          type="button"
          className="button secondary"
          id="debug-next"
          onClick={() => setDebugStep((step) => (step + 1) % 3)}
        >
          {debugStep === 2 ? "重新演示" : "下一步演示"} <span aria-hidden="true">{debugStep === 2 ? "↻" : "→"}</span>
        </button>
        <p className="demo-note">交互示意：点击按钮，观察 value 从 1 变为 3。</p>
      </div>
      <div className="debug-window feature-surface reveal">
        <div className="debug-window-top">
          <span className="status-dot"></span>
          <span id="debug-state">{debugStep === 2 ? "运行结束 · 输出 3" : "已在断点暂停"}</span>
          <span className="debug-file">main.c</span>
        </div>
        <div className="debug-content">
          <div className="debug-code">
            {debugCode.map((line, index) => (
              <div
                key={index}
                className={`debug-code-line ${debugStep < 2 && index === debugStep + 2 ? "current-line" : ""}`}
                data-debug-line={index}
              >
                <span className="debug-gutter">{index === 2 ? "●" : ""}</span>
                <span className="line-number">{index + 1}</span>
                <code>{line}</code>
                <span className="execution-arrow" aria-hidden="true">
                  ←
                </span>
              </div>
            ))}
          </div>
          <div className="debug-variables">
            <span className="variable-heading">
              局部变量 <span>⌄</span>
            </span>
            <div className="variable-row">
              <span className="variable-type">int</span>
              <span>value</span>
              <strong id="debug-value" className={debugStep > 0 ? "value-changed" : ""} aria-live="polite">
                {debugStep === 0 ? "1" : "3"}
              </strong>
            </div>
            <div className="variable-hint">
              <span className="status-dot"></span>
              <span id="debug-hint">
                {["执行下一行，看看值的变化。", "value += 2，变量现在是 3。", "输出 3，程序正常结束。"][debugStep]}
              </span>
            </div>
          </div>
        </div>
        <div className="debug-window-footer">
          <span>内置 CodeLLDB</span>
          <span>不必先编写调试配置</span>
        </div>
      </div>
    </section>
  );
}
