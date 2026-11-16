# Line 官网

官网：https://lec-org.github.io/lec-editor/

使用 `bun init --react=tailwind` 初始化的 React + TypeScript + Tailwind CSS 项目。Bun 负责依赖管理、开发服务、测试和静态构建，GitHub Pages 继续托管官网。

## 本地开发

使用 Bun 1.4.4 或更新版本；发布流水线固定为 1.4.4。

```sh
cd website
bun install --frozen-lockfile
bun dev
```

默认地址是 `http://127.0.0.1:4321/lec-editor/`，可通过 `PORT` 调整端口。

```sh
bun run check
bun test
bun run build
bun run preview
```

`preview` 提供 `dist/` 中的正式静态产物，适合检查预渲染和 React 接管交互后的行为。修改源码后需要重新构建，才能在产物预览中看到更新。

## 页面与构建

- `src/App.tsx`：页面内容、下载区和命令复制。
- `src/components/LineWindow.tsx`：从 Wu 移植并改编的交互编辑器窗口，支持文件树、标签、搜索、大纲、断点及预设运行调试。数据与高亮在 `lineWindowData.ts`；下方独立调试卡片位于 `DebugDemo.tsx`。演示不会在浏览器内编译或保存代码。
- `src/styles/global.css`：Tailwind 入口及页面视觉样式。
- `src/data/release.ts`：下载清单校验与平台信息。
- `build.ts`：打包前端资源并预渲染正文，输出到 `dist/`。正式托管无需 Bun 服务器。

部署前缀固定为 `/lec-editor/`，由 `src/data/release.ts` 的 `BASE_PATH` 统一用于资源与服务路径。正式 HTML 使用 React 预渲染，浏览器通过 hydration 接管交互。

## 下载与发布

`src/data/downloads.json` 在仓库中保留空清单。`.github/workflows/lec-pages.yml` 在部署时读取最近正式 GitHub Release 的 `downloads.json`，经过地址、摘要与文件大小校验后生成三端下载入口。浏览器无需令牌，也不会调用发布 API。

推送 `main` 的官网改动会自动部署。安装包发布成功后也会触发官网更新。官网按清单显示 GitHub 下载；只有清单包含 Gitee 附件时才显示对应入口。Gitee 工作暂缓，当前继续使用 GitHub Pages 托管。

编辑器安装包仍由独立的制品工作流构建，官网框架迁移不改变编辑器的 Rust/GPUI 实现。版权来源见 [NOTICE.md](NOTICE.md)。
