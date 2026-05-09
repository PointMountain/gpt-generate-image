---
title: OpenAI + AI SDK Image Workbench 集成修复
date: 2026-05-09
category: integration-issues
module: gpt-image-workbench
problem_type: integration_issue
component: tooling
symptoms:
  - "AI SDK image providerOptions 使用 snake_case，导致 outputFormat 和 outputCompression 不生效"
  - "Vite dev proxy 拼接兼容端点 baseURL 时丢失 /v1，导致请求落到错误上游路径"
  - "任意 baseURL 代理会携带用户 key 转发，形成 key 泄露和 SSRF 风险"
  - "取消生成只更新前端状态，没有 abort 上游代理请求"
  - "多参考图、mask、重复点击、blob URL 和 localStorage 旧值共同导致生成流程状态不一致"
root_cause: wrong_api
resolution_type: code_fix
severity: high
related_components:
  - openai-dev-proxy
  - ai-sdk-image-client
  - image-workbench-ui
  - settings-store
tags: [openai, ai-sdk, image-generation, provider-options, dev-proxy, base-url, ssrf, abort-controller]
---

# OpenAI + AI SDK Image Workbench 集成修复

## Problem

OpenAI Image Workbench 的 direct OpenAI + AI SDK 生图链路存在多点契约不一致：AI SDK provider options 字段名、Vite dev proxy 的 `/v1` 路径拼接、取消/并发状态、旧 localStorage 数据和上传输入边界都可能让真实生图失败或留下不可恢复状态。

这些问题在页面局部生图成功时不一定暴露，必须同时覆盖 AI SDK 调用参数、dev proxy 上游 URL、安全限制、前端并发清理和持久化数据 normalize。

## Symptoms

- 使用兼容 baseURL 走 dev proxy 时，`/api/openai/images/generations` 转发到上游会丢失 baseURL 中的 `/v1`。
- `providerOptions.openai` 使用 `output_format` / `output_compression` 时，AI SDK OpenAI provider 读取不到预期参数；当前实现需要 `outputFormat` / `outputCompression`，见 `src/lib/openai/ai-sdk-image-client.ts#buildOpenAIProviderOptions:80`。
- 连续点击生成可能发出重复请求；取消或超时后 UI 状态可能残留在生成中。
- 历史 mask preview 恢复后只有失效 blob URL，没有可提交的 `File`，导致表单看似恢复但不能再次提交。
- 旧 settings/preset 中的非法枚举、非法数字和 legacy `mode: "reference"` 会污染运行态。
- 过大、非图片、错误详情带密钥等输入/输出边界未统一处理时，会带来内存、UX 和泄漏风险。

## What Didn't Work

- 只看页面是否能生成图片不够：页面 live 成功不能证明 dev proxy 正确保留 `/v1`，也不能证明 `providerOptions` 字段名符合 AI SDK 契约。
- 只测客户端 `fetch('/api/openai/images/generations')` 不够：需要单独测试 `buildOpenAIProxyTarget('/api/openai/images/generations', 'https://host/v1')` 是否得到 `https://host/v1/images/generations`。
- 只处理 happy path 不够：没有覆盖 proxy abort/timeout、私网 host 拒绝、请求/响应大小限制时，本地 dev proxy 会变成 SSRF 或卡死入口。
- 只迁移 UI 不够：settings/preset localStorage 是跨版本长期存在的数据源，需要运行时 normalize，不能假设存量数据符合新类型。
- 只恢复历史参数不够：历史里的 mask preview URL 不是可发送文件，恢复 mask 模式会制造不可提交状态。

## Solution

修复按边界拆分：AI SDK client 负责请求契约和输入限制，dev proxy 负责 URL、安全和上游生命周期，App 负责生成任务状态，store 负责跨版本数据收敛。

### AI SDK 请求契约

`src/lib/openai/ai-sdk-image-client.ts#buildOpenAIProviderOptions:80` 改为使用 AI SDK 接受的 camelCase provider options，并由 SDK 映射为 OpenAI HTTP 请求体字段。这里的契约是：调用侧只输出 `outputFormat` / `outputCompression`，不直接输出 HTTP 层的 `output_format` / `output_compression`。

同一文件还补了几层边界：

- `src/lib/openai/ai-sdk-image-client.ts#validateImageFileLimits:100` 在读取 `arrayBuffer()` 前限制图片类型、单图 10MB、总 40MB。
- `src/lib/openai/ai-sdk-image-client.ts#buildPrompt:141` 明确把 text/image/mask 转成 AI SDK 接受的结构化 prompt。
- `src/lib/openai/ai-sdk-image-client.ts#createTimeoutController:163` 组合请求超时和外部取消信号。
- `src/lib/openai/ai-sdk-image-client.ts#redactSensitiveDetail:235` 展示错误前脱敏 `Bearer`、`sk-` 和 `Authorization`。

### Dev Proxy 路径、安全和上游生命周期

Vite proxy 从 `vite.config.ts` 拆到 `src/lib/openai/openai-dev-proxy.ts`，让核心 URL 构造可以被单测覆盖。旧写法里 `new URL('/images/generations', 'https://host/v1/')` 会把 `/v1` 覆盖掉；新契约是 `buildOpenAIProxyTarget('/api/openai/images/generations', 'https://host/v1')` 必须得到 `https://host/v1/images/generations`。

关键 guardrail：

- `src/lib/openai/openai-dev-proxy.ts#getAllowedOpenAIProxyHosts:18` 默认允许公网 HTTPS host，可通过 `OPENAI_DEV_PROXY_ALLOWED_HOSTS` 收窄到指定 host。
- `src/lib/openai/openai-dev-proxy.ts#validateOpenAIProxyBaseURL:60` 要求 HTTPS，并在配置了 allowlist 时拒绝非允许 host。
- `src/lib/openai/openai-dev-proxy.ts#isBlockedProxyHostname:46` 拒绝 localhost、私网、link-local 等目标。
- `src/lib/openai/openai-dev-proxy.ts#readRequestBody:100` 和 `src/lib/openai/openai-dev-proxy.ts#readUpstreamBody:119` 限制请求体和响应体大小。
- `src/lib/openai/openai-dev-proxy.ts#handleOpenAIProxy:170` 绑定 request/response 生命周期、190s timeout 和上游 `AbortController`。
- `vite.config.ts:11` 只保留 middleware 接入，不再把代理逻辑堆在配置文件里。

### App 生成状态

`src/app/App.tsx#runGeneration:283` 增加同步互斥和 generation id。重复点击时不会再启动第二个上游请求；旧请求返回时如果 id 已失效，不会覆盖当前结果。生成状态清理放在 `finally` 中，并且只允许当前 generation 清理 loading/ref。

其他状态修复：

- `src/app/App.tsx#App:102` 只读取一次初始 OpenAI settings，再派生初始 form。
- `src/app/App.tsx#revokeReferenceImages:94` 和 `src/app/App.tsx:160` 用 `latestFormRef` 在卸载时清理最新 blob URL，并 abort 当前生成。
- `src/app/App.tsx#handleCancelGeneration:368` 取消时 abort 当前请求、递增 generation id、清理 loading 状态。
- `src/app/App.tsx#applyHistoryEntryToEditor:375` 不再恢复历史里的 mask preview blob URL；历史 mask 模式降级为 image，只恢复可再次发送的纯参数。

### Persistent Store Normalize

`src/lib/openai/openai-settings-store.ts#normalizeStoredSettings:68` 对 localStorage 中的 settings 做运行时收敛：字符串字段按类型读取，`timeoutSeconds` 和 `defaultOutputCompression` 做数值边界收敛，`defaultSize`、`defaultQuality`、`defaultOutputFormat`、`defaultBackground` 通过枚举 allowlist 回退到默认值。

`src/features/presets/preset-store.ts#normalizeMode:35` 把旧预设的 `mode: "reference"` 迁移为当前 `mode: "image"`，未知 mode 回退为 `text`。`src/features/presets/preset-store.ts#normalizePresetRecord:45` 也会收敛尺寸、质量、格式、背景、张数和压缩值。

## Why This Works

根因不是单一 bug，而是多层边界同时偏离真实运行契约。

- AI SDK 层：OpenAI provider options 是 AI SDK 自己的类型契约，字段必须是 `outputFormat` / `outputCompression`；snake_case 字段不会被当前 provider options 类型正确表达。
- Proxy 层：URL 构造中以 `/` 开头的 pathname 会替换 base pathname，导致 `https://host/v1/` 的 `/v1` 被丢弃；拆出 `buildOpenAIProxyTarget` 后可以直接测试和固定这个行为。
- 浏览器层：图片生成是长耗时任务，必须用 `AbortController` 和 generation id 同时处理取消、超时、重复点击和旧请求回写。
- 持久化层：localStorage 数据没有 schema migration 保障，运行时 normalize 是最小且直接的防线。
- 输入层：图片文件会被读入内存并发送给 AI SDK，因此必须在读取前限制类型、单文件大小和总大小。
- 安全层：dev proxy 会代表浏览器请求用户填写的 baseURL，必须限制 HTTPS、私网地址、body size、response size 和 timeout；需要更严格环境时用 host allowlist 收窄目标。

## Prevention

- 保留 AI SDK provider options 测试，断言 `buildOpenAIProviderOptions()` 输出 camelCase，并覆盖 `gpt-image-2` 的透明背景和压缩参数归一化。
- 保留 dev proxy URL 测试，固定 `buildOpenAIProxyTarget('/api/openai/images/generations', 'https://host/v1')` 结果必须包含 `/v1/images/generations`。
- 保留 dev proxy 安全测试，覆盖非 HTTPS、私网 host、非 allowlist host。
- 保留本地 dev proxy fetch 测试，断言浏览器侧将 `https://api.openai.com/v1/images/generations` 改写为 `/api/openai/images/generations`，并带上 `x-openai-base-url`。
- 保留上传限制测试，断言超大文件在 `arrayBuffer()` 前被拒绝。
- 保留重复点击互斥测试，断言连续点击只调用一次 `generateOpenAIImages()`。
- 保留 settings/preset normalize 测试，覆盖非法类型、越界数字和旧 `mode: "reference"`。
- 最小门禁：相关单测和 `pnpm exec tsc -p tsconfig.app.json --noEmit`。触达构建配置、Vite proxy 或依赖时再跑 `pnpm run build`。
- 手动 smoke：改 dev proxy、baseURL 或真实请求形状后，用可用测试 key 和通用兼容端点做一次 live 验证，确认页面显示 `生成结果 1` 且 Network 中 `POST /api/openai/images/generations` 返回 `200`。

本次验证证据：

- `pnpm test`：14 个测试文件、41 个用例通过。
- `pnpm exec tsc -p tsconfig.app.json --noEmit`：通过。
- `pnpm run build`：通过。
- agent-browser live：使用通用兼容端点和 `gpt-image-2` 成功生成；页面显示 `生成结果 1`；`POST /api/openai/images/generations` 返回 `200`。

## Related Issues

- Related doc: `docs/solutions/integration-issues/openai-compatible-provider-image-generation-compatibility-2026-04-27.md`。它覆盖了更早的 OpenAI-compatible 参数兼容问题；本篇覆盖 direct OpenAI + AI SDK + dev proxy + App state 的新集成边界。
- Related doc: `docs/solutions/ui-bugs/results-gallery-style-issues-2026-05-01.md`。它只和工作台 UI 验证链路相邻，重叠较低。
