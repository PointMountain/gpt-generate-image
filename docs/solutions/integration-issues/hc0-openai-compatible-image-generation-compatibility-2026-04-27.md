---
title: HC0 OpenAI-Compatible 图片生成兼容性修复
date: 2026-04-27
category: integration-issues
module: gpt-image-workbench
problem_type: integration_issue
component: tooling
symptoms:
  - hc0.icu 可以成功返回 /v1/models，但图片生成在默认参数下频繁返回 504 Gateway Timeout
  - 同一 provider 对部分 image model 和参数组合仅部分可用，且会改写响应字段
  - 显式发送 size=1024x1024 或 n=1 时更容易触发超时
root_cause: wrong_api
resolution_type: code_fix
severity: medium
tags: [openai-compatible, hc0, image-generation, provider-profile, request-builder]
---

# HC0 OpenAI-Compatible 图片生成兼容性修复

## Problem

`https://hc0.icu` 能正常返回 `/v1/models`，但这不等于它严格兼容 OpenAI 图片接口。本项目最初按通用默认值发送 `size=1024x1024`、`quality=high`、`output_format=png`、`n=1`，在 `hc0` 上会把请求推向更容易超时的路径，最终让工作台长期停在 `504 Gateway Timeout`，而不是稳定返回图片。

这次修复的目标不是“替换图片接口”，而是把 `hc0` 识别成一个需要特殊收敛参数的 provider，并在请求构造阶段省略高风险字段。

## Symptoms

- `GET /v1/models` 正常，能发现 `gpt-image-1`、`gpt-image-1.5`、`gpt-image-2`。
- 图片生成对模型和参数组合明显敏感，不是“看到模型就能稳定出图”。
- 截至 `2026-04-27` 的人工联调观察，当前更稳的组合是：
  - `model=gpt-image-1.5`
  - 不传 `size`，由 provider 自动决定
  - `quality=low`
  - `response_format=b64_json`
  - 单张生成时不传 `n`
- 已确认容易失败的组合包括：
  - 显式 `size=1024x1024`
  - 显式 `n=1`
- 在当日测试 key 和默认参数下，直接使用 `gpt-image-2` 也观察到过 `504`，因此它只适合作为次选，而不是首选默认模型
- provider 可能会改写响应字段。实测中，请求 `gpt-image-1.5 + quality=low` 时，响应里可能写成 `model=gpt-image-2`、`quality=auto`、`size=auto`。

> 这些结论来自当前实测 key 和当日联调结果，不应被当成 `hc0` 的永久官方支持矩阵。

## What Didn't Work

- 只因为 `/v1/models` 成功，就假设 `/v1/images/generations` 也完全兼容。
- 继续沿用生成表单的通用默认值：

```ts
return {
  size: '1024x1024',
  count: 1,
  quality: 'high',
  outputFormat: 'png',
}
```

这段默认值定义在 `src/features/workbench/generation-form.tsx`，适合“标准兼容 provider”，但对 `hc0` 过于激进。

- 单张生成仍然显式发送 `n=1`。
- 失败后只展示 `504`，不给出下一步兼容建议。
- 只让用户手工切模型，不做 provider 识别，也不在请求层省略高风险字段。

## Solution

这次修复只做三件事。

1. 在 `src/lib/openai/provider-profile.ts` 里识别 `hc0.icu`，并给它一组更保守的推荐模型和默认参数：

```ts
const HC0_PROFILE: ProviderProfile = {
  id: 'hc0',
  recommendedModelIds: ['gpt-image-1.5', 'gpt-image-2', 'gpt-image-1'],
  recommendedSettings: {
    size: 'auto',
    quality: 'low',
    outputFormat: 'auto',
    responseMode: 'base64',
  },
}
```

2. 在 `src/app/App.tsx` 里只回填“仍未明确设置”的字段，而不是强制覆盖用户选择：

- `preferredModel` 为空时，回填 profile 推荐模型
- `fallback.responseMode` 仍为 `auto` 时，回填 `base64`
- 只有表单还处于 pristine 状态时，才把 `size`、`quality`、`outputFormat` 同步成推荐值

3. 在 `src/lib/openai/image-request-builder.ts` 里把 `"auto"` 这类 UI 状态转换成“省略字段”：

```ts
function shouldSendValue(value: string) {
  return value.trim() !== '' && value !== 'auto';
}

function shouldSendCount(count: number) {
  return Number.isFinite(count) && count > 1;
}
```

这让工作台在 `hc0` 上具备了两条关键行为：

- `size=auto` 时不发送 `size`
- 单张生成时不发送 `n`

此外，`src/features/onboarding/compatibility-help.tsx` 会提示“已识别 provider 特征”，`src/lib/openai/openai-compatible-client.ts` 会在 `504` 时附带 profile 级兼容建议。

## Why This Works

修复之所以有效，是因为它不再把 `hc0` 当成“严格 OpenAI 原样转发”的 provider，而是承认它是“部分兼容 provider”。

- “自动尺寸”被落实成“完全不发送 `size`”，而不是发送 `size=auto` 或继续固定 `1024x1024`
- “单张生成”被落实成“不发送 `n`”，避开了 `n=1` 的兼容问题
- 默认模型优先收敛到当前更稳的 `gpt-image-1.5`
- 失败时直接返回 provider 级建议，减少盲试

当前仓库里可复现的验证主要是 helper 层和错误提示层的单测，不包含真实 `hc0` 浏览器端到端出图。和本篇相关的已验证事实是：

- `src/lib/openai/provider-profile.test.ts`
- `src/lib/openai/image-request-builder.test.ts`
- `src/lib/openai/openai-compatible-client.test.ts`

另外，`2026-04-27` 当天人工联调确实生成过一张图片，产物保存在 `.artifacts/generated/hc0-seaside-2026-04-27T07-49-32-417Z.png`；这能证明当日组合有效，但不应视为自动化回归保证。

## Prevention

- 新接入“自称 OpenAI-compatible”的第三方时，不要只验证 `/v1/models`；至少把“模型发现成功”和“图片端点稳定出图”当成两个独立检查项。
- 如果某个 provider 只在特定组合下稳定，优先增加 provider profile，而不是把所有兼容逻辑都塞进全局默认值。
- 在 request builder 层明确区分“字段值为 auto”和“字段应该被省略”，不要把 UI 语义直接等同于 API 语义。
- 保留针对性回归测试：
  - `src/lib/openai/provider-profile.test.ts`
  - `src/lib/openai/image-request-builder.test.ts`
  - `src/lib/openai/openai-compatible-client.test.ts`
- 如果后续要把这类文档当成长期契约，最好再补一层可录制响应的集成测试或固定样本，避免 live provider 和测试 key 漂移。
- 实测矩阵如果明显依赖 key 或上游配置，要在文档里标明时间和前提，避免把临时观测误写成长期契约。

## Related Issues

- 浏览器直连第三方 provider 还会受到 `CORS` 限制。本项目之前已经通过本地代理模式处理这层问题，但那和本次“请求参数触发 504”的兼容缺陷是两层不同故障。
- `README.md` 目前只覆盖了通用兼容回退和本地代理说明，还没有收敛这次 `hc0` 的具体可用矩阵；如果后续要继续沉淀用户入口说明，可补一段指向本篇文档的链接。
- 相关背景文档：
  - `docs/brainstorms/2026-04-27-openai-compatible-image-workbench-requirements.md`
  - `docs/plans/2026-04-27-001-feat-openai-image-workbench-plan.md`
