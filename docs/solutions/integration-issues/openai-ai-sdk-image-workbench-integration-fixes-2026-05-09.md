---
title: OpenAI + AI SDK Image Workbench 集成修复
date: 2026-05-09
last_updated: 2026-05-10
category: integration-issues
module: gpt-image-workbench
problem_type: integration_issue
component: tooling
symptoms:
  - "AI SDK image providerOptions 使用 snake_case，导致 outputFormat 和 outputCompression 不生效"
  - "baseURL/dev proxy 逻辑在生成和模型发现中重复，官方 URL、兼容端点和 /v1 路径行为可能漂移"
  - "模型发现请求在 baseURL 校验前创建 Authorization header，存在 API key 发往未验证端点的风险"
  - "生成和模型发现缺少一致的 timeout、AbortSignal 和 stale response guard 时，旧请求会覆盖新状态"
  - "自定义 dropdown、settings/preset 枚举和 localStorage 旧值会让工作台交互状态漂移"
root_cause: wrong_api
resolution_type: code_fix
severity: high
related_components:
  - openai-dev-proxy
  - openai-endpoint
  - model-discovery
  - ai-sdk-image-client
  - image-workbench-ui
  - dropdown-field
  - settings-store
tags: [openai, ai-sdk, image-generation, provider-options, dev-proxy, base-url, model-discovery, abort-controller]
---

# OpenAI + AI SDK Image Workbench 集成修复

## Problem

OpenAI Image Workbench 的 direct OpenAI + AI SDK 链路存在多点契约不一致：AI SDK provider options 字段名、Vite dev proxy 的 `/v1` 路径拼接、provider/model discovery 的 endpoint 校验、取消/并发状态、旧 localStorage 数据和上传输入边界都可能让真实生图失败或留下不可恢复状态。

这些问题在页面局部生图成功时不一定暴露，必须同时覆盖 AI SDK 调用参数、dev proxy 上游 URL、模型列表拉取、安全限制、前端并发清理、custom dropdown 交互和持久化数据 normalize。

## Symptoms

- 使用兼容 baseURL 走 dev proxy 时，`/api/openai/images/generations` 转发到上游会丢失 baseURL 中的 `/v1`。
- `providerOptions.openai` 使用 `output_format` / `output_compression` 时，AI SDK OpenAI provider 读取不到预期参数；当前实现需要 `outputFormat` / `outputCompression`，见 `src/lib/openai/ai-sdk-image-client.ts#buildOpenAIProviderOptions:81`。
- 连续点击生成可能发出重复请求；取消或超时后 UI 状态可能残留在生成中。
- 模型发现初版只检查 `apiKey`，没有先校验 `baseURL`；`fetchOpenAIImageModels()` 会在 endpoint 校验前进入带 `Authorization` header 的请求构造路径。
- 模型发现没有 timeout、`AbortSignal`、request id 和 settings 变化清理时，慢 `/models` 请求会卡住 loading，旧 provider 的候选模型也可能覆盖新设置。
- 非 JSON `/models` 错误响应如果先读 `response.json()` 再读 `response.text()`，会丢失原始 status/message。
- 自定义 dropdown 初版混合 wrapper keyboard handler 和 focusable `button role="option"`，键盘用户按 Enter 可能选择 stale `activeIndex`。
- 历史 mask preview 恢复后只有失效 blob URL，没有可提交的 `File`，导致表单看似恢复但不能再次提交。
- 旧 settings/preset 中的非法枚举、非法数字和 legacy `mode: "reference"` 会污染运行态。
- 过大、非图片、错误详情带密钥等输入/输出边界未统一处理时，会带来内存、UX 和泄漏风险。

## What Didn't Work

- 只看页面是否能生成图片不够：页面 live 成功不能证明 dev proxy 正确保留 `/v1`，也不能证明 `providerOptions` 字段名符合 AI SDK 契约。
- 只测客户端 `fetch('/api/openai/images/generations')` 不够：需要单独测试 `buildOpenAIProxyTarget('/api/openai/images/generations', 'https://host/v1')` 是否得到 `https://host/v1/images/generations`。
- 只处理 happy path 不够：没有覆盖 proxy abort/timeout、私网 host 拒绝、请求/响应大小限制时，本地 dev proxy 会变成 SSRF 或卡死入口。
- 只在模型发现按钮上检查 `apiKey` 不够：任何会携带 `Authorization` 的请求都必须先通过 endpoint 校验，否则无效或未受信任 baseURL 会进入敏感请求路径。
- 只给 `/models` 拉取补错误提示不够：没有 timeout、abort 和 request id 时，慢请求仍会永久 loading，乱序响应仍会覆盖当前 provider 状态。
- 只把原生 `<select>` 换成自定义 dropdown 不够：如果 listbox、option 和 keyboard handler 的焦点模型不一致，ARIA 状态和实际选择会分叉。
- 只迁移 UI 不够：settings/preset localStorage 是跨版本长期存在的数据源，需要运行时 normalize，不能假设存量数据符合新类型。
- 只恢复历史参数不够：历史里的 mask preview URL 不是可发送文件，恢复 mask 模式会制造不可提交状态。
- `ce-plan -> ce-work` 初版实现已经通过 `pnpm test`、`pnpm build`、`pnpm test:e2e`，但后续 `ce-code-review` 仍发现 endpoint 校验、请求生命周期和 dropdown 语义 blocker；说明只跑 happy-path 验证不能替代安全/可靠性 review（session history）。

## Solution

修复按 6 个集成边界收敛，而不是在各个组件里继续加局部补丁。

1. AI SDK 请求参数只使用 provider 支持的 camelCase 契约。`src/lib/openai/ai-sdk-image-client.ts#buildOpenAIProviderOptions:81` 输出 `outputFormat` / `outputCompression`，让 AI SDK provider 映射到 OpenAI HTTP 字段；图片类型、大小、prompt 结构、timeout 和错误脱敏也留在同一个 client 边界内。

2. Dev proxy 只负责 URL、安全和上游生命周期。`src/lib/openai/openai-dev-proxy.ts` 固定 `/v1` 路径拼接、HTTPS/host allowlist、私网目标拒绝、请求/响应大小限制和上游 `AbortController`；`vite.config.ts` 只接入 middleware。

3. 所有前端 OpenAI endpoint 选择走同一个 resolver。`src/lib/openai/openai-endpoint.ts#validateOpenAIBaseURL:15` 负责 normalize 和 HTTPS 校验，`resolveOpenAIModelsRequestTarget()` 给 `/models`，`resolveOpenAIProviderTransport()` 给 AI SDK generation。敏感请求顺序必须是先校验 endpoint，再创建 header：

```ts
const target = resolveOpenAIModelsRequestTarget(settings.baseURL, deps.hostname);
if (!target.ok) {
  return { ok: false, detail: target.message };
}

const headers = new Headers({
  Authorization: `Bearer ${settings.apiKey}`,
});
```

4. 生成和模型发现都使用可取消的请求生命周期。`src/app/App.tsx#runGeneration:382` 用 generation id 阻止旧生成结果回写；`src/app/App.tsx#handleFetchModels:204` 先跑 settings validation，再用 `modelDiscoveryAbortRef`、`modelDiscoveryRequestIdRef` 和 `fetchOpenAIImageModels(..., { abortSignal })` 处理重复拉取、设置变化和乱序响应。`src/lib/openai/model-discovery.ts#readErrorDetail:180` 只读取一次错误 body，保留非 JSON 响应的 status/detail。

5. 持久化输入在读取时 normalize。`src/lib/openai/openai-settings-store.ts#normalizeStoredSettings:71` 和 `src/features/presets/preset-store.ts#normalizePresetRecord:46` 收敛旧 localStorage 的非法类型、越界数字、非法枚举和 legacy `mode: "reference"`，避免跨版本数据污染当前运行态。

6. 自定义 dropdown 和参数枚举各有单一来源。`src/lib/openai/openai-option-sets.ts:8` 定义尺寸、质量、格式、背景选项和 allowlist，settings、workbench、preset store 都从这里读取。`src/components/form/dropdown-field.tsx#DropdownField:34` 打开后把焦点转到 listbox，用 `aria-activedescendant` 表达 active option；trigger 仍保留打开阶段和焦点切换期间的键盘兜底处理。option 是非 focusable 的 `div role="option"`，导航跳过 disabled；`src/styles/global.css:.app-shell:44` 只裁横向，不裁纵向 dropdown popover。

## Why This Works

根因不是单一 bug，而是多个边界同时偏离真实契约：AI SDK 有自己的 provider option 类型，URL 构造会吞掉 base pathname，浏览器长耗时请求会乱序返回，localStorage 没有 schema migration，自定义 listbox 也不能混用多个 ARIA pattern。把这些规则集中到 endpoint、client、proxy、store、dropdown 这些明确边界后，未来改模型发现或生图链路时不需要在多个组件里猜同一套规则。

## Prevention

- OpenAI 请求入口必须复用 `src/lib/openai/openai-endpoint.ts`；带 `Authorization` 的请求先校验 endpoint，再创建 header。
- 测试保留 5 类门禁：AI SDK provider options camelCase、dev proxy `/v1` 和安全 guard、无效 model discovery baseURL 不调用 fetch、model discovery 乱序响应只接受最新 request id、dropdown 键盘选择和 disabled option。
- 长耗时请求都要有 timeout、外部 `AbortSignal` 和 stale response guard；影响 provider identity 的 `apiKey/baseURL` 变化时清空旧候选状态。
- settings、workbench、preset/store 不复制 OpenAI 参数枚举，只从 `src/lib/openai/openai-option-sets.ts` 读取。
- 最小门禁是相关单测加 TypeScript 检查；触达 Vite proxy、真实请求形状或 UI dropdown 时，再跑 `pnpm build` 和 `pnpm test:e2e`。
- 手动 smoke 用自定义 baseURL/dev proxy 验证路径拼接和转发，只证明 proxy/request shape 正确，不代表回到旧 OpenAI-compatible provider 主路径。

本次验证证据：

- `pnpm test`：14 个测试文件、41 个用例通过。
- `pnpm exec tsc -p tsconfig.app.json --noEmit`：通过。
- `pnpm run build`：通过。
- agent-browser live：用自定义 baseURL/dev proxy smoke 验证路径拼接和转发；页面显示 `生成结果 1`；`POST /api/openai/images/generations` 返回 `200`。
- 2026-05-10 refresh：`pnpm test`：17 个测试文件、62 个用例通过。
- 2026-05-10 refresh：`pnpm build`：通过。
- 2026-05-10 refresh：`pnpm test:e2e`：3 个用例通过。

## Related Issues

- Related doc: `docs/solutions/integration-issues/openai-compatible-provider-image-generation-compatibility-2026-04-27.md`。它覆盖了更早的 OpenAI-compatible 参数兼容问题；本篇覆盖 direct OpenAI + AI SDK + dev proxy + App state 的新集成边界。
- Related doc: `docs/solutions/ui-bugs/results-gallery-style-issues-2026-05-01.md`。它只和工作台 UI 验证链路相邻，重叠较低。
- GitHub issues: `gh issue list --search "OpenAI image workbench model discovery baseURL dev proxy dropdown providerOptions" --state all --limit 5` 没有返回相关 issue。
