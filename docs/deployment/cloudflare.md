# Cloudflare Deployment

TokenCanvas 的 Cloudflare 形态只托管静态 Web UI。用户在浏览器页面里填写自己的 OpenAI API key 和 baseURL；Cloudflare 不保存 OpenAI key，也不代理 `/api/openai/*` 请求。

## Cloudflare Form

在 Cloudflare 连接 GitHub 仓库创建应用时填写：

```text
Project name: token-canvas
Build command: pnpm run build
Deploy command: pnpm exec wrangler deploy
Root directory: /
Build output directory: dist
Node.js version: 22
```

不要在 Cloudflare 环境变量里配置 `OPENAI_API_KEY` 或 `TOKENCANVAS_PROXY_TOKEN`。这两个值不属于静态部署运行时。

## GitHub Actions

GitHub Actions 只做验证，不执行部署。真正的线上发布由 Cloudflare 控制台绑定的 GitHub 仓库集成负责。

因此仓库不需要配置 `CLOUDFLARE_API_TOKEN` 或 `CLOUDFLARE_ACCOUNT_ID` repository secrets。

## Local Verification

```bash
pnpm install
pnpm test
pnpm run typecheck:node
pnpm run build
```

`pnpm run build` 只生成静态 Web UI 到 `dist/`，不会部署。

## Deploy

```bash
pnpm run deploy:cloudflare
```

`deploy:cloudflare` 会先执行 `pnpm run build`，再调用 `wrangler deploy` 发布静态资源。它只作为本地手动部署命令；常规线上部署使用 Cloudflare 控制台的 GitHub 集成。

## Runtime Behavior

- 静态 Web UI 由 Cloudflare assets binding 服务。
- 未命中的 Web UI 路径按 SPA fallback 返回 `index.html`。
- 用户的 OpenAI API key、baseURL、历史记录和预设只保存在当前浏览器本地。
- Cloudflare 不持有服务端 OpenAI API key，也不会提供 OpenAI 代理 API。

如果公开部署给多人使用，应在页面入口外层使用 Cloudflare Access / Zero Trust 控制访问范围；这只保护页面访问，不替用户保存或代理 OpenAI 凭据。
