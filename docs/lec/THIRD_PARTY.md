# Wu 代码来源

本仓库基于 Zed v1.28.1（`e8bc16acee5ae1937600d571d441c4b5d7b0d288`）。保留上游许可证、作者记录和原有代码版权。

本次从 [dstrml/wu](https://github.com/dstrml/wu) 导入 GPL-3.0-or-later 代码，并按当前 Zed API 进行适配：

| 来源 | 本仓库中的用途 |
| --- | --- |
| [v1.2.2，41b71ce4905a](https://github.com/dstrml/wu/tree/41b71ce4905a8467bcf08d1f69a49a77c3a33052/crates/i18n) | `crates/i18n`、`assets/locales`；增加 LEC 名称词条、显式声明 serde derive 依赖；允许尚未接入界面的词条继续留在词典中 |
| [babb8f2d27f8](https://github.com/dstrml/wu/commit/babb8f2d27f82fdfe0bb29b25ead07338e09b2b0) | 中文字体回退、命令面板中英文检索、设置页与文件树、终端及工作区翻译；适配 Zed v1.28.1 的字段、弹窗和无障碍 API |
| [62edab06045e](https://github.com/dstrml/wu/commit/62edab06045e9e1920d12bc9936758fac4a4910d) | 活动栏及共用面板按钮行为；适配当前工作区布局，修正侧栏宽度对拖动坐标的影响 |
| [09fe357c8202](https://github.com/dstrml/wu/commit/09fe357c82029e4e976aee8a0ad1cac9ebecad3e) | 空目录提示行、键盘跳过提示行、拖放目标及相关回归测试 |

模块裁剪借鉴 Wu 的分层移除方式；Windows 安装隔离借鉴其独立标识经验。这两部分按当前 Zed 代码重新实施，没有整包移植 Wu 的历史删除提交或安装器。

保留 Wu 作者 dstrml 及贡献者的归属。各原有文件继续适用所属 crate 的许可证；`crates/i18n/LICENSE-GPL` 指向根目录 GPL 许可证。生成发布包时还需运行 `script/generate-licenses.ps1` 汇总完整依赖声明。
