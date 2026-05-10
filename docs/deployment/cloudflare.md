# Cloudflare Deployment

TokenCanvas 的 Cloudflare 形态托管 Web UI，并提供同源 `/api/openai/*` 转发层。用户在浏览器页面里填写自己的 OpenAI API key 和 baseURL；Cloudflare 不保存服务端 OpenAI key，只把当前请求里的用户 key 转发到用户填写的 OpenAI 兼容端点。

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

不要在 Cloudflare 环境变量里配置 `OPENAI_API_KEY` 或 `TOKENCANVAS_PROXY_TOKEN`。这两个值不属于当前部署运行时；API key 由用户在页面里填写。

## GitHub Actions

GitHub Actions 只做验证，不执行部署。真正的线上发布由 Cloudflare 控制台绑定的 GitHub 仓库集成负责。

因此仓库不需要配置 `CLOUDFLARE_API_TOKEN` 或 `CLOUDFLARE_ACCOUNT_ID` repository secrets。

## Local Verification

```bash
pnpm install
pnpm test
pnpm run typecheck:node
pnpm run build
pnpm exec wrangler deploy --dry-run
```

`pnpm run build` 会生成 Web UI 静态资源到 `dist/`，不会部署。
`pnpm exec wrangler deploy --dry-run` 只验证 Worker 和 assets 能被 Cloudflare 打包，不会发布线上版本。

## Deploy

```bash
pnpm run deploy:cloudflare
```

`deploy:cloudflare` 会先执行 `pnpm run build`，再调用 `wrangler deploy` 发布静态资源。它只作为本地手动部署命令；常规线上部署使用 Cloudflare 控制台的 GitHub 集成。

## Runtime Behavior

- Web UI 静态资源由 Cloudflare assets binding 服务。
- 未命中的 Web UI 路径按 SPA fallback 返回 `index.html`。
- 用户的 OpenAI API key、baseURL、历史记录和预设只保存在当前浏览器本地。
- `/api/openai/models`、`/api/openai/images/generations` 和 `/api/openai/images/edits` 由 Worker 同源转发到用户填写的 `x-openai-base-url`，用于绕过浏览器 CORS 限制。
- Worker 只允许 HTTPS baseURL，并拒绝 localhost、内网地址和非图片工作流相关路径。
- Cloudflare 不持有服务端 OpenAI API key，也不会替用户保存 OpenAI 凭据。

如果公开部署给多人使用，应在页面入口外层使用 Cloudflare Access / Zero Trust 控制访问范围；这只保护页面访问，不替用户保存 OpenAI 凭据。
