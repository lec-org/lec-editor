# 开源来源

官网早期基于 [Astroship](https://github.com/surjithctly/astroship) 的静态页面结构改编，来源提交 `da1272bb141abf42a3435d81774df92f0427ad57`，原作者为 surjithctly / Web3Templates。当前页面已迁移至使用 `bun init --react=tailwind` 初始化的 React + TypeScript + Tailwind CSS 项目。保留原有开源来源声明及 GPL-3.0 许可证，见 LICENSE。

## Wu 编辑器交互组件

`src/components/LineWindow.tsx` 与 `src/components/lineWindowData.ts` 改编自 [dstrml/wu](https://github.com/dstrml/wu) 的 `website/src/components/WuWindow.tsx` 和 `wuWindowData.ts`，固定来源提交为 `2c22e1da77dbbe4b1eb668eb56a43d3de8e73aa3`。原作者为 Wu 项目贡献者；上游采用 GPL-3.0-or-later 许可证，许可证全文见本目录 LICENSE 与仓库根目录 LICENSE-GPL。

2026-11-16 的改编保留窗口结构、Tailwind 样式、文件树、标签管理、搜索布局、代码行与大纲交互，替换为 Line 品牌及 C/C++ 入门示例，移除 AI、Git 与差异展示，补充预设运行、断点与变量演示，并调整键盘操作和无障碍标签。

`public/line-ui/` 中除 `file-c.svg`、`file-cpp.svg` 外的 SVG 图标来自上述提交的 `website/public/wu-ui/`。C/C++ 文件图标来自本仓库沿用的 Zed 图标，改编时仅调整颜色。

代码区使用本仓库已有的 Lilex 字体，原作者为 The Lilex Project Authors；字体保持原样，随附 SIL Open Font License 1.1，见 `public/fonts/Lilex-OFL.txt`。

编辑器基于 [Zed](https://github.com/zed-industries/zed)，应用版权与各组件许可证保持上游声明。本官网不表示获得 Zed Industries 官方认证。
