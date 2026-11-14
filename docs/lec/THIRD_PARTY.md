# Wu 代码来源

本仓库基于 Zed v1.28.1（`e8bc16acee5ae1937600d571d441c4b5d7b0d288`）。保留上游许可证、作者记录和原有代码版权。

本次从 [dstrml/wu](https://github.com/dstrml/wu) 导入 GPL-3.0-or-later 代码，并按当前 Zed API 进行适配：

| 来源                                                                                                           | 本仓库中的用途                                                                                                       |
| -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| [v1.2.2，41b71ce4905a](https://github.com/dstrml/wu/tree/41b71ce4905a8467bcf08d1f69a49a77c3a33052/crates/i18n) | `crates/i18n`、`assets/locales`；增加 LEC 名称词条、显式声明 serde derive 依赖；允许尚未接入界面的词条继续留在词典中 |
| [babb8f2d27f8](https://github.com/dstrml/wu/commit/babb8f2d27f82fdfe0bb29b25ead07338e09b2b0)                   | 中文字体回退、命令面板中英文检索、设置页与文件树、终端及工作区翻译；适配 Zed v1.28.1 的字段、弹窗和无障碍 API        |
| [62edab06045e](https://github.com/dstrml/wu/commit/62edab06045e9e1920d12bc9936758fac4a4910d)                   | 活动栏及共用面板按钮行为；适配当前工作区布局，修正侧栏宽度对拖动坐标的影响                                           |
| [09fe357c8202](https://github.com/dstrml/wu/commit/09fe357c82029e4e976aee8a0ad1cac9ebecad3e)                   | 空目录提示行、键盘跳过提示行、拖放目标及相关回归测试                                                                 |

模块裁剪借鉴 Wu 的分层移除方式；Windows 安装隔离借鉴其独立标识经验。这两部分按当前 Zed 代码重新实施，没有整包移植 Wu 的历史删除提交或安装器。

保留 Wu 作者 dstrml 及贡献者的归属。各原有文件继续适用所属 crate 的许可证；`crates/i18n/LICENSE-GPL` 指向根目录 GPL 许可证。生成发布包时还需运行 `script/generate-licenses.ps1` 汇总完整依赖声明。

## 内置 C/C++ 工具链

三端 LEC 打包脚本附带 [Zig 0.17.1 官方发行包](https://ziglang.org/download/)，使用其中的 Clang、链接器、C/C++ 头文件及运行库编译学生程序。工具链独立放置在 `lec-run` 旁的 `toolchains/zig`，不改写系统编译环境。

Zig 主体使用 MIT 许可证；其中 LLVM、libc++、libc++abi、musl、MinGW-w64、Darwin 等组件各自保留原有许可证和版权。打包时复制原始发行包的完整内容，包括根目录 `LICENSE`、`lib` 内的许可证及来源声明，不以 Zig 主体许可证替代这些组件的许可证。安装包内的 `LEC-TOOLCHAIN.json` 记录固定版本、平台、官方二进制下载地址、SHA256 和对应的官方源码归档地址；版本与摘要由 `script/lec-toolchain.json` 管理。

## 内置 C/C++ 调试器

基础调试使用 CodeLLDB 1.12.3 及其随附的 LLDB 22.1.8、CPython 3.12.7，安装在 `toolchains/codelldb`，保留原始发行包内容并补充 `assets/debugger-licenses` 中的许可证。固定版本、官方地址和 SHA256 记录在 `script/lec-toolchain.json`，安装结果记录于 `LEC-DEBUGGER.json`。

macOS 新版官方包缺少 `debugserver`，因此从 CodeLLDB 1.11.8 官方包中补充这一辅助程序，保留其原有签名；不替换新版 LLDB。旧版 LLDB 20 在本机读取新系统的 Mach-O 符号时崩溃，不能整体回退。辅助程序采用 LLDB 20.1.4 对应的许可证，并单独锁定来源及摘要。打包后必须实际验证断点、变量、单步和退出，不能以 `--help` 成功代替调试验收。
