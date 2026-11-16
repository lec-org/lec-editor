import index from "./index.html";
import { BASE_PATH } from "./data/release";

const preview = process.argv.includes("--preview");
const redirectHome = () => new Response(null, { status: 302, headers: { Location: `${BASE_PATH}/` } });
const server = Bun.serve({
  hostname: "127.0.0.1",
  port: Number(process.env.PORT ?? 4321),
  routes: preview
    ? undefined
    : {
        [BASE_PATH]: redirectHome(),
        [`${BASE_PATH}/`]: index,
        [`${BASE_PATH}/line.png`]: new Response(Bun.file("public/line.png")),
        "/": redirectHome(),
      },
  async fetch(request) {
    const pathname = new URL(request.url).pathname;
    if (!preview) return new Response("未找到页面", { status: 404 });
    if (pathname === "/" || pathname === BASE_PATH) return redirectHome();
    const relativePath = pathname.startsWith(`${BASE_PATH}/`) ? pathname.slice(BASE_PATH.length + 1) : null;
    if (relativePath === null || relativePath.includes("..")) return new Response("未找到页面", { status: 404 });
    const file = Bun.file(`dist/${relativePath || "index.html"}`);
    return (await file.exists()) ? new Response(file) : new Response("未找到页面", { status: 404 });
  },
  development: !preview && { hmr: true, console: true },
});
console.log(`Line 官网${preview ? "制品预览" : "开发服务"}：${server.url}${BASE_PATH.slice(1)}/`);
