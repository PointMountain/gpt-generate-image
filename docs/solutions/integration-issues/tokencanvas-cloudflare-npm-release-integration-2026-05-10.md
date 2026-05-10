---
title: TokenCanvas Cloudflare 与 npm 发布集成收口
date: 2026-05-10
category: integration-issues
module: token-canvas-release
problem_type: integration_issue
component: tooling
symptoms:
  - "Cloudflare build 只启用 Worker 插件，Web UI 默认仍停留在本地 API key 模式"
  - "Hosted proxy 只允许 /models 和 /images/generations，图生图和 mask 请求会在 /images/edits 返回 404"
  - "npm package smoke 只验证 tokencanvas --help，没有证明已安装包能启动 Web UI"
  - "npm publish workflow 在 pull_request job 中授予 id-token: write，扩大了未受信 PR 的 OIDC 权限面"
root_cause: missing_workflow_step
resolution_type: workflow_improvement
severity: high
related_components:
  - "cloudflare-worker"
  - "npm-package"
  - "github-actions"
  - "worker-openai-proxy"
  - "tokencanvas-web"
tags: [cloudflare, npm, worker, package-smoke, github-actions, hosted-proxy, release]
---

# TokenCanvas Cloudflare 与 npm 发布集成收口

## Problem

TokenCanvas 要同时提供 Cloudflare 托管 Web UI 和 npm 安装后的 CLI/TUI/Web UI。初版发布链路看起来能构建和打包，但 `ce-code-review` 发现几个跨运行时契约没有真正被验证：Cloudflare UI 默认不走 Worker proxy、Worker 不支持 image edit 路由、npm smoke 没启动新增的 `tokencanvas web`，以及发布 workflow 权限过宽。

如果这些问题不修，合并后 Cloudflare 可以成功部署一个行为错误的 UI，npm 也可能发布一个 `--help` 可用但 Web UI 启不起来的包。

## Symptoms

- `package.json#scripts.build:cloudflare` 只设置 `TOKENCANVAS_CLOUDFLARE=true`，但 `src/lib/openai/openai-settings-store.ts#readHostedProxyDefault` 只读取 `VITE_TOKENCANVAS_HOSTED_PROXY`。
- `src/worker/openai-proxy.ts#ALLOWED_PROXY_ROUTES` 缺少 `POST /images/edits`，和 Web UI 已支持的图生图 / mask 流程不匹配。
- `src/worker/openai-proxy.ts#validateRequestSize` 只看 `Content-Length`，没有 header 或 header 非法时无法强制 40MB 请求体上限。
- `scripts/smoke-package.mjs` 只运行已安装包的 `tokencanvas --help`，没有请求 packaged `dist/web`。
- `.github/workflows/npm-publish.yml` 把 `id-token: write` 放在同一个会跑 pull request 代码的 `package` job 上。

## What Didn't Work

- 只跑 `pnpm run build:cloudflare` 不够。Vite build 通过只能说明产物可生成，不能说明客户端默认状态匹配 Cloudflare hosted proxy 合约。
- 只测试 `POST /images/generations` 不够。当前产品已经支持参考图和 mask，这些文件型图片请求会走 OpenAI image edits 端点。
- 只用 `Content-Length` 做大小限制不够。浏览器、代理或 Worker runtime 可以遇到无长度 header 的 body，必须在应用层按真实字节数限制。
- 只验证 `tokencanvas --help` 不够。npm 用户真正新增的能力是 `tokencanvas web` 启动 packaged Web UI，必须从安装后的 tarball 里启动并请求页面。
- 把验证和发布放进同一个 GitHub Actions job 不够。PR 验证 job 不应该拥有 npm trusted publishing 所需的 OIDC 权限。

## Solution

1. Cloudflare build 同时注入 Worker 构建标记和客户端 hosted 标记：

```json
"build:cloudflare": "TOKENCANVAS_CLOUDFLARE=true VITE_TOKENCANVAS_HOSTED_PROXY=true vite build"
```

这样 fresh browser/localStorage 下的 `createDefaultOpenAISettings()` 会进入 `hostedProxy: true`，页面展示部署访问 token 字段，并通过 `/api/openai/*` 调 Worker proxy。

2. Worker proxy 明确覆盖当前产品实际使用的 OpenAI 图片路由：

```ts
const ALLOWED_PROXY_ROUTES = [
  { method: 'GET', pathname: '/models' },
  { method: 'POST', pathname: '/images/generations' },
  { method: 'POST', pathname: '/images/edits' },
];
```

同时在转发前读取请求体并按 `MAX_WORKER_PROXY_REQUEST_BYTES` 做真实字节限制；上游 fetch 使用 `AbortController` 加应用层 timeout，超时返回稳定 `openai_proxy_request_timeout` JSON。

3. npm package smoke 从“入口存在”升级为“安装后可运行”：

```js
const help = run(binPath, ['--help'], { cwd: tempDir });
await smokeWebCommand(binPath, tempDir);
```

`smokeWebCommand()` 从已安装 tarball 启动 `tokencanvas web --host 127.0.0.1 --port <free-port>`，请求 `/` 和 `/workbench/history`，证明 packaged `dist/web` 可以服务 SPA fallback。

4. npm publish workflow 拆成两个 job：

- `package` job 运行在 PR/tag/workflow_dispatch，权限只有 `contents: read`。
- `publish` job 只在 `refs/tags/v*` 运行，才授予 `id-token: write` 并执行 `npm publish --provenance --access public`。

发布前还要校验 tag 与 `package.json.version` 一致：

```bash
PACKAGE_VERSION=$(node -p "require('./package.json').version")
test "${GITHUB_REF_NAME}" = "v${PACKAGE_VERSION}"
```

5. Cloudflare workflow 加入 pull request 验证和 e2e：

```yaml
on:
  pull_request:
    paths:
      - package.json
      - pnpm-lock.yaml
      - src/**
      - tests/e2e/**
      - playwright.config.ts
      - vite.config.ts
      - wrangler.jsonc
      - .github/workflows/cloudflare-deploy.yml
```

这样发布前能在 PR 阶段发现 hosted build、Worker、Vite/e2e 和 workflow 配置问题。

## Why This Works

这次问题的根因不是单个构建失败，而是发布链路没有把“哪个 runtime 读取哪个配置、哪个端点由谁代理、哪个 workflow 拥有哪些权限、哪个 smoke 证明哪种用户能力”写成可验证契约。

修复后，Cloudflare build 的客户端默认状态和 Worker runtime 对齐；Worker 白名单覆盖当前 Web UI 的 text/image/mask 三类 OpenAI 图片请求；npm tarball smoke 证明安装后的 Web UI 真的能启动；npm trusted publishing 的 OIDC 权限只存在于 tag-only publish job。每条发布路径都有与其真实用户入口一致的验证，而不是只证明源码仓库里的开发命令能跑。

## Prevention

- Cloudflare 托管功能要同时验证两个层面：Worker runtime 能代理对应 API，浏览器 bundle 默认会进入 hosted proxy 模式。
- 新增 OpenAI 图片能力时，Worker 白名单必须跟 AI SDK 实际端点一起更新，至少覆盖 `/models`、`/images/generations` 和 `/images/edits`。
- 代理请求体限制不能只信任 `Content-Length`；大请求要按真实 body byte length 做应用层限制。
- npm package smoke 必须从真实 tarball 安装后执行新能力；新增 `tokencanvas web` 就要启动 server 并请求页面。
- GitHub Actions 的发布权限要和触发条件分离：PR 验证 job 不拿 OIDC，tag-only publish job 才拿 `id-token: write`。
- npm 发布不能只匹配 `v*`，还要校验 tag 名和 `package.json.version` 一致。
- 发布前保留完整门禁：`pnpm test`、`pnpm run typecheck:node`、`pnpm run build`、`pnpm run test:e2e`、`pnpm run build:package && pnpm run package:smoke`、`pnpm run build:cloudflare`、`git diff --check`。

本次验证证据：

- `pnpm test`：40 个测试文件、162 个用例通过。
- `pnpm run typecheck:node`：通过。
- `pnpm run build`：通过。
- `pnpm run test:e2e`：3 个 Playwright 用例通过。
- `pnpm run build:package && pnpm run package:smoke`：通过，包含安装后启动 `tokencanvas web`。
- `pnpm run build:cloudflare`：通过，并带 `VITE_TOKENCANVAS_HOSTED_PROXY=true`。
- `pnpm install --frozen-lockfile`：通过。
- workflow YAML 解析检查：通过。
- `git diff --check`：通过。

## Related Issues

- Related doc: `docs/solutions/integration-issues/tokencanvas-tui-workbench-integration-notes-2026-05-10.md`。它覆盖 CLI/TUI、本地 proxy 和 e2e 边界；本篇覆盖 Cloudflare/npm 发布边界。
- Related doc: `docs/solutions/integration-issues/openai-ai-sdk-image-workbench-integration-fixes-2026-05-09.md`。它覆盖 direct OpenAI + AI SDK 请求和模型发现契约；本篇补充 hosted Worker 和发布 workflow 契约。
- Related plan: `docs/plans/2026-05-10-004-feat-cloudflare-npm-release-plan.md`
