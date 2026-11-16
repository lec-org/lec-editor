import { useEffect, useState, type ComponentProps } from "react";
import { DebugDemo } from "./components/DebugDemo";
import { LineWindowFrame } from "./components/LineWindow";
import { BASE_PATH, files, hasGitee, platforms, release, size, version } from "./data/release";

function Container({ className = "", ...props }: ComponentProps<"div">) {
  return <div className={`site-container ${className}`} {...props} />;
}
function Link({ className = "", ...props }: ComponentProps<"a">) {
  return <a className={`button ${className}`} {...props} />;
}

export function App() {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  async function copyCommand() {
    try {
      await navigator.clipboard.writeText("line .");
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  }
  useEffect(() => {
    if (!("IntersectionObserver" in window) || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.08 },
    );
    document.querySelectorAll(".reveal").forEach((element) => observer.observe(element));
    document.documentElement.classList.add("enhanced");
    return () => {
      observer.disconnect();
      document.documentElement.classList.remove("enhanced");
    };
  }, []);

  return (
    <>
      <a className="skip-link" href="#main">
        跳到正文
      </a>
      <header className="site-header">
        <Container className="nav">
          <a className="brand glass" href="#" aria-label="Line 首页">
            <img src={`${BASE_PATH}/line.png`} width="32" height="32" alt="" />
            <span>Line</span>
          </a>
          <nav className="glass" aria-label="主导航">
            <a href="#experience">编辑体验</a>
            <a href="#debugging" className="nav-detail">
              调试
            </a>
            <a href="https://github.com/lec-org/lec-editor" className="nav-source">
              GitHub <span aria-hidden="true">↗</span>
            </a>
            <a className="nav-download" href="#downloads">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" />
              </svg>
              下载
            </a>
          </nav>
        </Container>
      </header>
      <main id="main">
        <div className="hero-shell">
          <div className="hero-atmosphere" aria-hidden="true">
            <div className="light-ribbon"></div>
            <div className="light-ribbon ribbon-two"></div>
          </div>
          <section className="hero" aria-labelledby="hero-title">
            <Container>
              <div className="hero-copy">
                <a className="release-label" href="https://github.com/lec-org/lec-editor/releases">
                  <span className="status-dot"></span>
                  {version ? `Line ${version} 现已发布` : "为 C / C++ 初学者而来"}
                  <span aria-hidden="true">↗</span>
                </a>
                <h1 id="hero-title">
                  从第一行代码，
                  <br />
                  到第一个<span className="hero-result">「我会了」。</span>
                </h1>
                <p className="hero-description">
                  为 C / C++ 初学者而来的轻量编辑器。
                  <br />
                  中文界面，内置编译与调试工具。打开，就能开始。
                </p>
                <div className="hero-actions">
                  <Link href="#downloads">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" />
                    </svg>
                    免费下载 Line
                  </Link>
                  <a className="button secondary" href="#experience">
                    看看编辑器 <span aria-hidden="true">↘</span>
                  </a>
                </div>
                <p className="hero-platforms">
                  macOS <span>·</span> Windows <span>·</span> Linux{" "}
                  <span className="platform-note">无需另装编译器</span>
                </p>
              </div>
              <LineWindowFrame />
            </Container>
          </section>
        </div>

        <Container>
          <section className="media-section toolchain-section" aria-labelledby="toolchain-title">
            <div className="setup-window feature-surface reveal">
              <div className="mini-title">
                <img src={`${BASE_PATH}/line.png`} width="24" height="24" alt="" />
                开始你的第一次练习
                <span className="ready-badge">
                  <span className="status-dot"></span>准备就绪
                </span>
              </div>
              <div className="setup-folder">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M3 6h7l2 3h9v11H3z" />
                </svg>
                <span>C语言练习</span>
                <span className="folder-empty">空文件夹</span>
              </div>
              <div className="creation-actions">
                <span>从一份源文件开始</span>
                <a href="#experience">
                  <span className="file-token">C</span>创建 C 文件 <span aria-hidden="true">＋</span>
                </a>
                <div className="creation-divider">
                  <span>或</span>
                </div>
                <a href="#experience">
                  <span className="file-token cpp-token">C++</span>创建 CPP 文件 <span aria-hidden="true">＋</span>
                </a>
              </div>
              <div className="setup-checks">
                <span>
                  <i>✓</i>C / C++ 编译工具
                </span>
                <span>
                  <i>✓</i>调试器
                </span>
                <span>
                  <i>✓</i>中文界面
                </span>
              </div>
              <p className="visual-note">界面示意 · 下载后即可在编辑器中创建</p>
            </div>
            <div className="media-copy reveal">
              <span className="eyebrow">开始，简单一点</span>
              <h2 id="toolchain-title">
                第一课是写代码，
                <br />
                环境已经准备好了。
              </h2>
              <p>
                不必先找编译器、配路径。Line 在三个系统上都内置 Zig C/C++ 工具链，从空文件夹创建一份 C 或 C++
                文件，就能开始练习。
              </p>
              <a className="button secondary" href="#downloads">
                选择你的系统 <span aria-hidden="true">↗</span>
              </a>
              <div className="feature-tags">
                <span>C17</span>
                <span>C++17</span>
                <span>无需配置 PATH</span>
              </div>
            </div>
          </section>

          <DebugDemo />
          <section className="workflow-section" aria-labelledby="workflow-title">
            <div className="workflow-heading reveal">
              <span className="eyebrow">学编程，少一点阻碍</span>
              <h2 id="workflow-title">
                写代码需要的，
                <br />
                就在你熟悉的位置。
              </h2>
            </div>
            <div className="workflow-steps">
              <article className="reveal">
                <span className="step-index">01 / 编写</span>
                <h3>用中文，找到下一步</h3>
                <p>文件操作、常用菜单与运行入口使用中文。保留语法高亮、代码补全与问题提示，让注意力回到代码。</p>
              </article>
              <article className="reveal">
                <span className="step-index">02 / 运行</span>
                <h3>按 F5，看见结果</h3>
                <p>在底部终端查看输出、输入数据。编译失败时不会运行旧产物，当前源文件和运行结果对应得上。</p>
              </article>
              <article className="reveal">
                <span className="step-index">03 / 专注</span>
                <h3>工具，恰好够用</h3>
                <p>无需登录，打开即可使用。编辑、搜索、终端和基础调试，加上主题与图标扩展，按自己的节奏学习。</p>
              </article>
            </div>
          </section>

          <section className="open-source reveal" aria-labelledby="open-title">
            <div className="source-symbol" aria-hidden="true">
              {"</>"}
            </div>
            <h2 id="open-title">原生的底子，开源的自由。</h2>
            <p>
              Line fork 自 Zed，用 Rust 与 GPUI 构建。
              <br />
              保留扎实的编辑器核心，为 C / C++ 入门精简体验。
              <br />
              每一处改动，都可以在源码里看到。
            </p>
            <div className="center-actions">
              <a className="button" href="https://github.com/lec-org/lec-editor">
                查看源代码 <span aria-hidden="true">↗</span>
              </a>
              <a className="button secondary" href="https://github.com/lec-org/lec-editor#使用说明">
                阅读使用说明 <span aria-hidden="true">↗</span>
              </a>
            </div>
            <div className="cli-strip">
              <span>习惯终端？用命令打开项目。</span>
              <button type="button" id="copy-cli" onClick={copyCommand} aria-label="复制 line 点命令">
                <code>
                  <span>❯</span> line .
                </code>
                <span className="copy-label">
                  {copyState === "copied" ? "已复制 ✓" : copyState === "failed" ? "请选中命令复制" : "复制 ⧉"}
                </span>
              </button>
              <span id="copy-status" className="sr-only" aria-live="polite">
                {copyState === "copied"
                  ? "已复制命令 line 点"
                  : copyState === "failed"
                    ? "无法访问剪贴板，请手动选中并复制命令。"
                    : ""}
              </span>
            </div>
          </section>

          <section id="downloads" className="downloads" aria-labelledby="download-title">
            <div className="download-heading reveal">
              <img
                className="download-icon"
                src={`${BASE_PATH}/line.png`}
                width="88"
                height="88"
                alt=""
                loading="lazy"
              />
              <h2 id="download-title">写下你的第一行。</h2>
              <p>
                选好系统，下载 Line。
                <br />
                编译器和调试器，一起准备好了。
              </p>
              <span className="version-label">{version ? `v${version} · 免费开源` : "安装包正在构建"}</span>
            </div>
            <div className="platform-grid">
              {platforms.map((platform) => {
                const file = files.find((file) => file.name === platform.file);
                return (
                  <article key={platform.key} className="platform feature-surface reveal" data-platform={platform.key}>
                    <div className="platform-icon" aria-hidden="true">
                      {platform.icon}
                    </div>
                    <h3>{platform.name}</h3>
                    <p>{platform.arch}</p>
                    {file ? (
                      <>
                        <Link href={file.github} data-download={platform.key}>
                          下载 {platform.extension}
                          <span aria-hidden="true">↓</span>
                        </Link>
                        <span className="file-size">
                          {size(file.size)} <span>· 内置 C/C++ 工具链</span>
                        </span>
                        {file.gitee.parts.length > 0 && (
                          <details className="gitee-download">
                            <summary>从 Gitee 下载</summary>
                            <div className="gitee-parts">
                              {file.gitee.parts.map((part, index) => (
                                <a key={part.url} href={part.url}>
                                  {file.gitee.parts.length > 1
                                    ? `下载分卷 ${index + 1} / ${file.gitee.parts.length}`
                                    : "下载安装包"}{" "}
                                  <span>↓</span>
                                </a>
                              ))}
                              {file.gitee.command && (
                                <>
                                  <p>下载全部分卷后，在下载目录执行：</p>
                                  <pre>{file.gitee.command}</pre>
                                </>
                              )}
                            </div>
                          </details>
                        )}
                        <details className="checksum">
                          <summary>SHA-256 校验值</summary>
                          <code>{file.sha256}</code>
                        </details>
                      </>
                    ) : (
                      <div className="awaiting">
                        <span>安装包构建中</span>
                        <a href="https://github.com/lec-org/lec-editor/releases">查看发行记录 ↗</a>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
            <p className="download-notice">macOS 安装包未经 Apple 公证，Windows 安装包尚未签名。更新请回到本页下载。</p>
            <div className="release-links">
              <a href="https://github.com/lec-org/lec-editor/releases">
                查看发行记录 <span aria-hidden="true">↗</span>
              </a>
              {hasGitee && <a href="https://gitee.com/lec-org/lec-editor/releases">Gitee 发行记录 ↗</a>}
              {release.commit && (
                <a href={`https://github.com/lec-org/lec-editor/tree/${release.commit}`}>
                  本版本源码 <span aria-hidden="true">↗</span>
                </a>
              )}
            </div>
          </section>

          <section className="faq-section reveal" aria-labelledby="faq-title">
            <h2 id="faq-title">你可能还想知道。</h2>
            <div className="faq-list">
              <details>
                <summary>
                  还需要自己安装编译器吗？<span aria-hidden="true">＋</span>
                </summary>
                <p>
                  正式安装包已经附带 Zig C/C++ 工具链和 CodeLLDB 调试器，无需额外安装编译器或手动配置系统
                  PATH。从源码构建则需要按仓库说明准备工具。
                </p>
              </details>
              <details>
                <summary>
                  C 和 C++ 都可以写吗？<span aria-hidden="true">＋</span>
                </summary>
                <p>
                  可以。保存为 .c 时使用 C17，保存为 .cpp、.cc、.cxx 时使用
                  C++17。当前快捷运行入口编译单个源文件，适合入门阶段的独立练习。
                </p>
              </details>
              <details>
                <summary>
                  Line 和 Zed 是什么关系？<span aria-hidden="true">＋</span>
                </summary>
                <p>
                  Line fork 自 Zed，当前固定基于 Zed v1.28.1，沿用 Rust 与 GPUI 的原生编辑基础，再为 C/C++
                  初学者精简功能、补充中文界面与编译运行体验。Line 保留上游版权声明和开源许可证。
                </p>
              </details>
              <details>
                <summary>
                  在 Mac 上按 F5 没有反应？<span aria-hidden="true">＋</span>
                </summary>
                <p>部分 Mac 键盘需要按 Fn + F5，也可以直接点击编辑器右上角的「运行」按钮。调试对应 F6，断点对应 F9。</p>
              </details>
            </div>
          </section>
        </Container>
      </main>
      <footer className="site-footer">
        <Container>
          <div className="footer-top">
            <div className="footer-brand">
              <a className="brand" href="#" aria-label="返回顶部">
                <img src={`${BASE_PATH}/line.png`} width="36" height="36" alt="" />
                <span>Line</span>
              </a>
              <p>让第一行代码，更容易开始。</p>
            </div>
            <nav aria-label="页脚">
              <div>
                <span>Line</span>
                <a href="#downloads">下载</a>
                <a href="#experience">编辑体验</a>
                <a href="#debugging">基础调试</a>
              </div>
              <div>
                <span>资源</span>
                <a href="https://github.com/lec-org/lec-editor#使用说明">使用说明</a>
                <a href="https://github.com/lec-org/lec-editor/releases">版本发布</a>
                <a href="https://github.com/lec-org/lec-editor/issues">反馈问题</a>
              </div>
              <div>
                <span>开源</span>
                <a href="https://github.com/lec-org/lec-editor">GitHub ↗</a>
                <a href="https://github.com/zed-industries/zed">上游 Zed ↗</a>
                <a href="https://github.com/lec-org/lec-editor/blob/main/LICENSE-GPL">GPL-3.0</a>
              </div>
            </nav>
          </div>
          <div className="footer-bottom">
            <p>
              Powered by <strong>乐程软件工作室</strong>
            </p>
            <span>基于 Zed · 为初学者而来</span>
            <a href="#">回到顶部 ↑</a>
          </div>
        </Container>
      </footer>
    </>
  );
}
