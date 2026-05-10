# Cloudflare Deployment

TokenCanvas 的 Cloudflare 形态使用 Workers static assets：同一个 Worker 同时托管 Web UI 静态资源，并处理 `/api/openai/*` 代理。

## Required Secrets

在 Cloudflare Worker 上配置：

- `OPENAI_API_KEY`: Worker 服务端调用 OpenAI 的 key。
- `TOKENCANVAS_PROXY_TOKEN`: 浏览器访问 `/api/openai/*` 时必须提供的部署访问 token。

在 GitHub Actions repository secrets 中配置：

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

不要把 OpenAI key、Cloudflare token 或部署访问 token 写进 `wrangler.jsonc`、`.env`、README 示例输出或 npm 包产物。

## Local Verification

```bash
pnpm install
pnpm test
pnpm run typecheck:node
pnpm run build:cloudflare
```

`pnpm run build:cloudflare` 只构建 Worker 和 Web UI，不会部署。

## Deploy

```bash
pnpm exec wrangler secret put OPENAI_API_KEY
pnpm exec wrangler secret put TOKENCANVAS_PROXY_TOKEN
pnpm run deploy:cloudflare
```

`deploy:cloudflare` 会先执行 Cloudflare 构建，再调用 `wrangler deploy`。真实部署需要已登录 Wrangler 或提供 CI secrets。

## Runtime Behavior

- 静态 Web UI 由 Cloudflare assets binding 服务。
- 未命中的 Web UI 路径按 SPA fallback 返回 `index.html`。
- `/api/openai/models`、`/api/openai/images/generations` 和 `/api/openai/images/edits` 由 Worker 代理处理。
- Worker 只读取服务端 `OPENAI_API_KEY` secret，不信任浏览器传入的 OpenAI Authorization。
- 请求必须带 `x-tokencanvas-proxy-token`，或 `Authorization: Bearer <TOKENCANVAS_PROXY_TOKEN>`。

公开部署时，`TOKENCANVAS_PROXY_TOKEN` 是最低保护。更高强度的访问控制应在 Cloudflare Access / Zero Trust 中配置。
