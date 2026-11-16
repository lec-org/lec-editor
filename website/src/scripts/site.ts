const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const revealElements = document.querySelectorAll<HTMLElement>('.reveal');
if ('IntersectionObserver' in window && !reducedMotion.matches) {
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    }
  }, { threshold: 0.08 });
  revealElements.forEach(element => observer.observe(element));
  document.documentElement.classList.add('enhanced');
}

const sourceCode = document.querySelector<HTMLElement>('#source-code');
const languageTabs = [...document.querySelectorAll<HTMLButtonElement>('[data-language]')];
const runButton = document.querySelector<HTMLButtonElement>('#run-demo');
const runLabel = document.querySelector<HTMLElement>('[data-run-label]');
const terminalCommand = document.querySelector<HTMLElement>('#terminal-command');
const terminalResult = document.querySelector<HTMLElement>('#terminal-result');
const terminalStatus = document.querySelector<HTMLElement>('#terminal-status');
const statusLanguage = document.querySelector<HTMLElement>('#status-language');
let language = 'c';
let runTimer: ReturnType<typeof setTimeout> | undefined;
const examples = {
  c: ['<span class="syntax-purple">#include</span> <span class="syntax-green">&lt;stdio.h&gt;</span>', '', '<span class="syntax-purple">int</span> <span class="syntax-blue">main</span>(<span class="syntax-purple">void</span>) {', '    <span class="syntax-blue">printf</span>(<span class="syntax-green">"Hello, Line!\\n"</span>);', '    <span class="syntax-purple">return</span> <span class="syntax-orange">0</span>;', '}'],
  cpp: ['<span class="syntax-purple">#include</span> <span class="syntax-green">&lt;iostream&gt;</span>', '', '<span class="syntax-purple">int</span> <span class="syntax-blue">main</span>() {', '    std::<span class="syntax-blue">cout</span> &lt;&lt; <span class="syntax-green">"Hello, Line!"</span> &lt;&lt; std::endl;', '    <span class="syntax-purple">return</span> <span class="syntax-orange">0</span>;', '}'],
};
function resetRun() {
  clearTimeout(runTimer);
  if (runButton) runButton.disabled = false;
  if (runLabel) runLabel.textContent = '运行演示';
  if (terminalCommand) terminalCommand.textContent = `编译运行 main.${language}`;
  if (terminalResult) terminalResult.textContent = 'Hello, Line!';
  if (terminalStatus) terminalStatus.innerHTML = '<span>✓</span> 程序已结束，退出代码 0';
}
for (const tab of languageTabs) {
  tab.addEventListener('click', () => {
    language = tab.dataset.language === 'cpp' ? 'cpp' : 'c';
    languageTabs.forEach(other => {
      other.setAttribute('aria-selected', String(other === tab));
      other.tabIndex = other === tab ? 0 : -1;
    });
    document.querySelector('#code-example')?.setAttribute('aria-labelledby', tab.id);
    document.querySelectorAll('[data-filename]').forEach(element => element.textContent = `main.${language}`);
    if (sourceCode) sourceCode.innerHTML = examples[language as keyof typeof examples].map((line, index) => `<span class="code-line"><span class="line-number" aria-hidden="true">${index + 1}</span><code>${line || ' '}</code></span>`).join('');
    if (statusLanguage) statusLanguage.textContent = language === 'cpp' ? 'C++' : 'C';
    resetRun();
  });
  tab.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const next = languageTabs.find(other => other !== tab);
    next?.focus();
    next?.click();
  });
}
runButton?.addEventListener('click', () => {
  runButton.disabled = true;
  if (runLabel) runLabel.textContent = '编译中…';
  if (terminalCommand) terminalCommand.textContent = `正在编译 main.${language}…`;
  if (terminalResult) terminalResult.textContent = '';
  if (terminalStatus) terminalStatus.textContent = '正在预览编译运行过程';
  runTimer = setTimeout(resetRun, reducedMotion.matches ? 0 : 700);
});

let debugStep = 0;
const debugButton = document.querySelector<HTMLButtonElement>('#debug-next');
const debugValue = document.querySelector<HTMLElement>('#debug-value');
const debugState = document.querySelector<HTMLElement>('#debug-state');
const debugHint = document.querySelector<HTMLElement>('#debug-hint');
debugButton?.addEventListener('click', () => {
  debugStep = (debugStep + 1) % 3;
  document.querySelectorAll<HTMLElement>('[data-debug-line]').forEach(line => {
    line.classList.toggle('current-line', debugStep < 2 && Number(line.dataset.debugLine) === debugStep + 2);
  });
  if (debugValue) {
    debugValue.textContent = debugStep === 0 ? '1' : '3';
    debugValue.classList.toggle('value-changed', debugStep > 0);
  }
  if (debugState) debugState.textContent = debugStep === 2 ? '运行结束 · 输出 3' : '已在断点暂停';
  if (debugHint) debugHint.textContent = ['执行下一行，看看值的变化。', 'value += 2，变量现在是 3。', '输出 3，程序正常结束。'][debugStep];
  debugButton.innerHTML = debugStep === 2 ? '重新演示 <span aria-hidden="true">↻</span>' : '下一步演示 <span aria-hidden="true">→</span>';
});

document.querySelector<HTMLButtonElement>('#copy-cli')?.addEventListener('click', async () => {
  const label = document.querySelector<HTMLElement>('.copy-label');
  const status = document.querySelector<HTMLElement>('#copy-status');
  try {
    await navigator.clipboard.writeText('line .');
    if (label) label.textContent = '已复制 ✓';
    if (status) status.textContent = '已复制命令 line 点';
  } catch {
    if (label) label.textContent = '请选中命令复制';
    if (status) status.textContent = '无法访问剪贴板，请手动选中并复制命令。';
  }
});

const editor = document.querySelector<HTMLElement>('[data-tilt]');
if (editor && window.matchMedia('(hover: hover) and (pointer: fine)').matches && !reducedMotion.matches) {
  editor.addEventListener('pointermove', (event) => {
    const bounds = editor.getBoundingClientRect();
    editor.style.setProperty('--tilt-x', `${((event.clientY - bounds.top) / bounds.height - 0.5) * -1.6}deg`);
    editor.style.setProperty('--tilt-y', `${((event.clientX - bounds.left) / bounds.width - 0.5) * 1.6}deg`);
  });
  editor.addEventListener('pointerleave', () => {
    editor.style.setProperty('--tilt-x', '0deg');
    editor.style.setProperty('--tilt-y', '0deg');
  });
}
