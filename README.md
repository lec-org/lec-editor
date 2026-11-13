> [!IMPORTANT]
> Remove this line to confirm you've reviewed this PR before submitting.

# LEC Editor

LEC Editor 是面向大一新生的极简中文 C/C++ 编辑器，基于 Zed，参考 Wu 的功能裁剪与中文化实现，围绕“打开文件、编写代码、运行程序”提供清晰的学习流程。

[产品官网](https://lec-org.github.io/lec-editor/) · [发行记录](https://github.com/lec-org/lec-editor/releases) · [Gitee 镜像](https://gitee.com/lec-org/lec-editor)

## 当前能力

- 默认简体中文，可切换英语或跟随系统语言。
- 保留文件树、标签页、搜索、代码轮廓和终端，精简无关入口。
- 打开当前 C/C++ 文件，按 **F5** 或点击编辑区右上角的**运行**，自动保存、编译并在终端运行。
- 终端支持 `scanf`、`std::cin` 等交互输入，可用 **Ctrl+C** 中断程序。
- 编译失败时不会运行上一次的旧程序；每次运行使用独立临时目录。
- Windows 应用、安装目录和用户数据使用独立的 LEC 标识。

## 使用说明

1. 新建或打开 `.c`、`.cpp`、`.cc`、`.cxx` 文件。
2. 编写代码，点击**运行**或按 **F5**。部分 Mac 键盘需使用 **Fn+F5**。
3. 在底部终端查看结果、输入数据，或用 **Ctrl+C** 停止运行。

当前运行入口编译单个源文件，使用 C17 / C++17。程序的工作目录为源文件所在目录。首次运行未保存的文件时会显示保存对话框，取消保存则不运行。

**当前尚未随包提供编译器。** 需要本机已有 Clang 或 GCC，并可从 PATH 查找到。暂未提供正式安装包；多源文件构建、第三方库管理和调试仍待完善。

## 本地构建

需要 Rust `1.98.1`。macOS 还需要 Xcode Command Line Tools 和 CMake：

```sh
cargo +1.98.1 build --locked -p zed --bin leceditor -p c_runner --bin lec-run --features gpui_platform/runtime_shaders
./target/debug/leceditor
```

Windows 需要 Visual Studio C++ Build Tools、Windows SDK、PowerShell 7 和 Inno Setup 6。在具备 MSVC 环境的终端中执行：

```powershell
./script/bundle-lec-windows.ps1
```

构建与验收范围见[实施记录](docs/lec/IMPLEMENTATION.md)。

## 开源说明

LEC Editor 固定基于 Zed `v1.28.1`，保留上游版权声明与许可证。主体代码使用 GPL-3.0-or-later，部分组件使用 Apache-2.0；导入 Wu 的代码及来源记录见[第三方说明](docs/lec/THIRD_PARTY.md)。

更多开发约束见[上游基线记录](UPSTREAM.md)与[第一阶段说明](docs/lec/README.md)。
