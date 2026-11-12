# 前四项基础改造

## 本次代码范围

1. 从应用生产依赖和启动流程移除 Agent UI、协作面板、项目侧栏、REPL、miniprofiler、journal 和模型提供商初始化。停用 AI、上游登录入口、首次启动引导和上游遥测；保留本地日志。设置页不再列出 AI 与协作栏目。
2. 导入 Wu 的 i18n crate 和中文词典。默认简体中文；可在设置中选择英语、简体中文或系统语言。核心菜单、文件树、终端、工作区提示、设置与命令检索已接入。缺失词条回退英文。开发时设置 `LEC_PSEUDO_TRANSLATION=1` 可检查文本长度。
3. 导入左侧活动栏与空目录提示。活动栏复用原有面板动作，点击当前面板可收起；`activity_bar.show=false` 恢复底部面板按钮。空目录提示不会作为文件被键盘选中，并保留向空目录拖入文件的行为。继续使用 Zed 默认的单击预览、双击固定标签，不增加首次配置步骤。
4. 将程序与用户数据标识改为 LEC。Windows 安装到 `%LOCALAPPDATA%\Programs\LECEditor`，配置位于 `%APPDATA%\LECEditor`，数据位于 `%LOCALAPPDATA%\LECEditor`。安装器使用独立 GUID、互斥锁、文件关联和应用 ID。更新菜单打开 LEC Releases，不实例化上游自动更新器。

这些基础改造尚不包含默认 `.c` 新文件、内置编译器、库目录或平台登录，也没有进行性能测量。当前文件运行功能见下文。

## 当前文件运行

打开本地 `.c`、`.cpp`、`.cc` 或 `.cxx` 文件，按 **F5**（部分 Mac 键盘需 **Fn+F5**），或点击编辑区右上角的 **运行**。编辑器先保存当前文件，再编译并在底部终端运行；未保存的文件会先显示保存对话框。取消保存时不运行。终端可直接输入，支持 `scanf` 和 `std::cin`；运行中可按 **Ctrl+C** 中断。

`lec-run` 是随编辑器提供的独立控制台程序，使用 C17 / C++17、`-Wall -Wextra -g` 编译单个源文件。每次编译使用独立临时目录，编译失败不执行旧程序，正常结束后清理输出；程序工作目录为源文件所在目录。文件路径作为独立参数传递。此入口不读取项目任务配置，也不自动放开项目受限模式。

当前开发版先查找 `lec-run` 同目录下的 `toolchains/bin`，再查找 PATH 中的 Clang/GCC。**尚未随包提供编译器**；缺少编译器时终端会明确提示，因此暂未达到无依赖的开箱即用。多源文件链接、第三方库管理和调试不在本次实现内。Git、调试面板及其默认快捷键和命令入口已收起，保留文件树、搜索、轮廓和终端。

## 依赖边界

当前裁剪对象是应用入口与对应生产依赖。编辑器、设置页、标题栏和项目模型仍共享部分 agent、call、channel、LiveKit 等底层 crate；未宣称二进制已经完全清除 AI/协作实现。上游测试工具也保留部分 dev-dependencies。后续分离这些依赖应单独验证模型与窗口生命周期。

保留上游源码目录和内部 `zed` crate 名称，便于跟进修复。项目级 `.zed/settings.json` 与内部动作协议仍兼容原版。用户数据路径、实际可执行文件和 Windows 安装身份独立。原来的 `script/bundle-windows.ps1` 是上游流程，LEC 发布请使用下面的新脚本。

## 构建和检查

Rust 版本为 `1.98.1`。Windows 需要 Visual Studio C++ Build Tools、Windows SDK、PowerShell 7 和 Inno Setup 6，并在具备 MSVC 环境的终端执行：

```powershell
python script/check-lec.py
cargo +1.98.1 test --locked -p i18n
cargo +1.98.1 test --locked -p c_runner --lib
cargo +1.98.1 check --locked -p zed --bin leceditor
cargo +1.98.1 test --locked -p project_panel empty_row
cargo +1.98.1 test --locked -p workspace activity_bar_entries_and_toggle
./script/bundle-lec-windows.ps1
```

安装脚本生成便携 ZIP 和安装 EXE，检查主程序、CLI、`lec-run.exe` 与 ConPTY 文件是否存在，并生成许可证声明。当前 Zed 的 `util::command` 已为后台进程设置 `CREATE_NO_WINDOW`，因此没有再移植 Wu 的 Agent 进程封装。当前安装器不包含 Explorer 扩展，不覆盖用户默认文件关联，仅添加 C/C++ 文件的“打开方式”。发布包暂未配置签名和自动更新。原版图标资源暂时保留，后续替换品牌图形。

`.github/workflows/lec-editor.yml` 对 Windows 应用、翻译、文件树行为、活动栏和安装器语法进行检查，并在 Linux 上验证真实 C/C++ 编译及运行。安装器语法检查使用临时占位文件，不生成可供用户安装的正式应用包。

macOS 开发构建需要 Rust、Xcode Command Line Tools 和 CMake。只有 Command Line Tools 时，可使用运行时 Metal shader 编译：

```sh
cargo +1.98.1 build --locked -p zed --bin leceditor -p c_runner --bin lec-run --features gpui_platform/runtime_shaders
cargo +1.98.1 test --locked -p c_runner
./target/debug/leceditor --dump-all-actions > /tmp/lec-actions.json
python3 script/check-lec.py --actions-json /tmp/lec-actions.json
```

Debug 版本从源码目录读取资源，启动时可执行文件或工作目录必须位于 checkout 内；复制到临时 `.app` 后也要保留这一条件。上述构建不等同于可分发、签名的 macOS 安装包。

## 验收范围

本地已通过 `git diff --check`、修改文件的 rustfmt 检查，以及 1298 个词条和产品边界检查。[Windows CI](https://github.com/lec-org/lec-editor/actions/runs/43253336241) 已通过锁定依赖的 12 项 i18n 测试、完整应用编译检查、3 项空目录回归测试、1 项活动栏回归测试和安装器语法检查。其后仅清理无用导入及未使用的旧反馈函数、同步自动更新默认值的测试断言，并更新文档；这些清理通过本地格式与产品边界检查。

尚未生成正式 release 安装包。安装、卸载、与 Zed 并存、中文 DPI 显示及输入法、活动栏实际拖动和 C/C++ 交互终端仍需 Windows 实机验收；仅通过语法、编译或模拟界面测试不等同于这些行为验收完成。

2026-11-13 在 Apple Silicon macOS 上完成完整 Debug 构建和原生窗口启动，实际打开 C 文件，确认语法高亮、中文空目录提示、左侧活动栏和文件树显示。修复了裁剪模块后残留快捷键导致的启动崩溃，并单独恢复原先由协作 UI 初始化的标题栏。全部 20 份内置键位配置通过 JSONC 解析和实际二进制动作注册表核对，产品边界检查也会阻止已裁剪模块的快捷键重新进入默认配置。本次未执行完整上游测试套件。

Wu 导入记录见 [THIRD_PARTY.md](THIRD_PARTY.md)。

当前文件运行改造已通过 macOS Debug 完整构建、9 项运行工具测试（含真实 C/C++ 编译、标准输入、相对文件访问、中文及特殊字符路径、编译失败、退出码和缺失编译器）、格式检查，以及全部内置键位与实际动作注册表核对。新增运行按钮及精简后的面板已在原生窗口中检查；编辑器内的端到端交互和 Windows 实机运行仍需单独验收，不能用命令行测试代替。
