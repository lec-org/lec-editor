# 前四项基础改造

## 本次代码范围

1. 从应用生产依赖和启动流程移除 Agent UI、协作面板、项目侧栏、REPL、miniprofiler、journal 和模型提供商初始化。停用 AI、上游登录入口、首次启动引导和上游遥测；保留本地日志。设置页不再列出 AI 与协作栏目。
2. 导入 Wu 的 i18n crate 和中文词典。默认简体中文；可在设置中选择英语、简体中文或系统语言。核心菜单、文件树、终端、工作区提示、设置与命令检索已接入。缺失词条回退英文。开发时设置 `LEC_PSEUDO_TRANSLATION=1` 可检查文本长度。
3. 导入左侧活动栏与空目录提示。活动栏复用原有面板动作，点击当前面板可收起；`activity_bar.show=false` 恢复底部面板按钮。空目录提示不会作为文件被键盘选中，并保留向空目录拖入文件的行为。继续使用 Zed 默认的单击预览、双击固定标签，不增加首次配置步骤。
4. 将程序与用户数据标识改为 LEC。Windows 安装到 `%LOCALAPPDATA%\Programs\LECEditor`，配置位于 `%APPDATA%\LECEditor`，数据位于 `%LOCALAPPDATA%\LECEditor`。安装器使用独立 GUID、互斥锁、文件关联和应用 ID。更新菜单打开 LEC Releases，不实例化上游自动更新器。

这些改造尚不包含默认 `.c` 新文件、内置编译器、编译运行按钮、库目录或平台登录，也没有进行性能测量。

## 依赖边界

当前裁剪对象是应用入口与对应生产依赖。编辑器、设置页、标题栏和项目模型仍共享部分 agent、call、channel、LiveKit 等底层 crate；未宣称二进制已经完全清除 AI/协作实现。上游测试工具也保留部分 dev-dependencies。后续分离这些依赖应单独验证模型与窗口生命周期。

保留上游源码目录和内部 `zed` crate 名称，便于跟进修复。项目级 `.zed/settings.json` 与内部动作协议仍兼容原版。用户数据路径、实际可执行文件和 Windows 安装身份独立。原来的 `script/bundle-windows.ps1` 是上游流程，LEC 发布请使用下面的新脚本。

## 构建和检查

Rust 版本为 `1.98.1`。Windows 需要 Visual Studio C++ Build Tools、Windows SDK、PowerShell 7 和 Inno Setup 6，并在具备 MSVC 环境的终端执行：

```powershell
python script/check-lec.py
cargo +1.98.1 test --locked -p i18n
cargo +1.98.1 check --locked -p zed --bin leceditor
cargo +1.98.1 test --locked -p project_panel empty_row
cargo +1.98.1 test --locked -p workspace activity_bar_entries_and_toggle
./script/bundle-lec-windows.ps1
```

安装脚本生成便携 ZIP 和安装 EXE，检查主程序与 ConPTY 文件是否存在，并生成许可证声明。当前安装器不包含 Explorer 扩展，不覆盖用户默认文件关联，仅添加 C/C++ 文件的“打开方式”。发布包暂未配置签名和自动更新。原版图标资源暂时保留，后续替换品牌图形。

`.github/workflows/lec-editor.yml` 对 Windows 应用、翻译、文件树行为、活动栏和安装器语法进行检查。安装器语法检查使用临时占位文件，不生成可供用户安装的正式应用包。

## 验收范围

源代码检查结果与构建日志需结合 CI 状态查看。安装、卸载、与 Zed 并存、中文 DPI 显示及输入法、活动栏拖动和 C/C++ 交互终端仍需 Windows 实机验收；仅通过语法或编译检查不等同于这些行为验收完成。

Wu 导入记录见 [THIRD_PARTY.md](THIRD_PARTY.md)。
