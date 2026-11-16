import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { App } from "./App";
import "./styles/global.css";

const container = document.getElementById("root");
if (!container) throw new Error("未找到网页根节点");
const app = (
  <StrictMode>
    <App />
  </StrictMode>
);
// 正式构建带有预渲染正文；Bun 开发服务器从空容器启动。
if (import.meta.hot) {
  (import.meta.hot.data.root ??= createRoot(container)).render(app);
} else if (container.hasChildNodes()) {
  hydrateRoot(container, app);
} else {
  createRoot(container).render(app);
}
