# LEC Editor 官网与发布

官网：https://lec-org.github.io/lec-editor/

采用 Astroship 的开源静态站点结构，来源及许可证见 [NOTICE.md](NOTICE.md)。GitHub Pages 托管同一官网，页面同时提供 GitHub 和 Gitee 下载入口。Gitee Pages 已下线，因此没有单独的 Gitee 站点。

## 本地预览

需要 Node.js 22.12 或更新版本。

```sh
cd website
npm ci
npm run dev
```

`src/data/downloads.json` 在首次发布前为空，页面明确显示构建中。部署流程会从最近的正式 LEC GitHub Release 下载制品清单；浏览器不需要令牌，也不调用发布 API。

## 发布安装包

1. 在仓库 Actions Secret 中配置 `GITEE_TOKEN`，使用仅授权 `lec-org/lec-editor`、`projects` 权限的 Gitee 仓库级令牌。令牌过期后需要更新 Secret。
2. 在 `main` 运行 **LEC 制品发布** 工作流，输入新标签，例如 `lec-v1.30.0`。三个平台必须全部构建成功后才会发布。关闭 `publish` 可只测试构建。
3. 流水线复用上游原生打包脚本，构建 macOS ARM64 DMG、Windows x64 EXE 和 Linux x64 TAR.GZ。保留 `dev` 通道、Zed Dev 应用名和上游许可证，并通过上游提供的 `ZED_UPDATE_EXPLANATION` 禁用自动更新，避免混用上游安装包。
4. GitHub Release 起初为草稿，Gitee 制品和清单全部上传成功后才公开。官网流水线随后自动更新下载入口。失败时可从失败的任务重新运行，或重新运行官网工作流；已经正式发布的版本禁止覆盖。

`script/lec-release.mjs` 为安装包生成 SHA-256，并把相同内容上传到两个源。Gitee 普通仓库单附件限制 100 MB，因此超过 95 MB 的文件会按字节分卷；页面提供全部分卷链接和 Windows / macOS / Linux 还原命令。还原后必须核对原始安装包 SHA-256。Gitee 的单仓库总附件配额为 1 GB，历史版本附件需要按实际容量人工管理，脚本不会自动删除旧版本。

首批安装包没有 Apple 公证或 Windows 代码签名证书，不应当作官方 Zed 安装包分发。CI 构建成功也不等于已在各平台完成安装、启动与业务验收。

## 检查

```sh
node --test script/lec-release.test.mjs
npm --prefix website run build
```

根目录 README 的人工审阅标记来自仓库 AGENTS.md，需由维护者审阅后手动移除。
