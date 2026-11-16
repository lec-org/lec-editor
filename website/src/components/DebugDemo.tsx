import { useState } from "react";

const debugCode = [
  "int main(void) {",
  "    int value = 1;",
  "    value += 2;",
  '    printf("%d\\n", value);',
  "    return 0;",
  "}",
];

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
