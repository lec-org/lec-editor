import tailwind from "bun-plugin-tailwind";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { cp, mkdir, rm } from "node:fs/promises";
import { App } from "./src/App";
import { BASE_PATH } from "./src/data/release";

await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });
const result = await Bun.build({
  entrypoints: ["src/index.html"],
  outdir: "dist",
  publicPath: `${BASE_PATH}/`,
  plugins: [tailwind],
  minify: true,
  target: "browser",
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
});
if (!result.success) throw new AggregateError(result.logs, "官网构建失败");
const html = Bun.file("dist/index.html");
const document = await html.text();
// 在构建阶段生成正文，浏览器只负责接管交互，GitHub Pages 无需运行 Bun 服务。
if (!document.includes("<!--app-->")) throw new Error("缺少官网预渲染占位符");
await Bun.write(
  html,
  document.replace("<!--app-->", () => renderToString(createElement(App))),
);
await cp("public", "dist", { recursive: true });
await Bun.write("dist/.nojekyll", "");
console.log(`已生成静态官网：${result.outputs.length} 个构建文件，路径 ${BASE_PATH}/`);
