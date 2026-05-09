---
title: OpenAI-Compatible 图片生成兼容性排查
date: 2026-04-27
category: integration-issues
module: gpt-image-workbench
problem_type: integration_issue
component: tooling
symptoms:
  - OpenAI-compatible 端点可以成功返回 /v1/models，但图片生成在默认参数下超时或失败
  - 同一 provider 对部分 image model 和参数组合仅部分可用，且可能改写响应字段
  - 显式发送固定 size 或 n=1 时更容易触发兼容问题
root_cause: wrong_api
resolution_type: code_fix
severity: medium
tags: [openai-compatible, image-generation, provider-profile, request-builder]
---

# OpenAI-Compatible 图片生成兼容性排查

## Problem

OpenAI-compatible 端点能返回 `/v1/models`，不代表它严格兼容 OpenAI 图片接口。模型发现、图片生成、参数支持和响应字段稳定性是四个独立契约，任一层漂移都会让工作台长期停在超时、空结果或解析失败状态。

这类问题不能绑定到某个具体 baseURL 或某个私有 provider。项目应保留通用的兼容性边界：参数可省略、错误可解释、请求构造可测试，但不要把某个端点的临时可用矩阵写成长期默认逻辑。

## Symptoms

- `GET /v1/models` 正常，但 `/v1/images/generations` 不稳定。
- 图片生成对模型和参数组合敏感，不是“看到模型就能稳定出图”。
- 某些端点只在省略 `size`、省略单张 `n`、降低质量或改用 base64 响应时更稳定。
- provider 可能改写响应字段，例如把请求中的模型、质量或尺寸归一化成自己的内部值。
- 这些观察通常依赖当时的 key、上游配置和模型版本，不能沉淀为全项目默认。

## What Didn't Work

- 只因为 `/v1/models` 成功，就假设 `/v1/images/generations` 也完全兼容。
- 把某个端点的实测参数矩阵写进全局默认值。
- 单张生成仍然显式发送 `n=1`。
- 失败后只展示 HTTP 状态码，不给出“减少参数、检查端点图片能力、切换响应模式”等下一步建议。
- 把 UI 的 `auto` 语义直接发送给 API，而不是在 request builder 层决定是否省略字段。

## Solution

通用修复只保留可迁移的工程边界。

1. 在请求构造层把 UI 状态和 API payload 分开：`auto`、空值和默认单张计数应转换成“省略字段”，而不是强行发送。
2. 把模型发现和图片生成当成独立能力验证：模型列表只能说明端点暴露了模型元数据，不能证明图片生成端点支持同一组参数。
3. 错误提示保持通用：在超时、空响应或字段解析失败时，引导用户检查端点是否支持图片生成、是否需要完整 `/v1` 路径、是否需要减少可选参数。
4. 测试固定通用行为：请求构造、响应归一化、错误脱敏和 dev proxy URL 拼接都用 `example.com` 或 OpenAI 默认端点作为样例，不写入私有域名。

## Why This Works

修复有效的关键不是识别某个 provider，而是承认 OpenAI-compatible 生态会存在部分兼容。

- “自动尺寸”落实成“按需省略 `size`”，避免把 UI 默认值误当 API 契约。
- “单张生成”落实成“不发送 `n`”，减少兼容端点对显式默认值的分歧。
- 错误提示回到通用诊断，不把私有端点、临时 key 或某天的联调结果写成产品逻辑。
- 单测覆盖请求 shape 和响应 shape，避免后续把具体 baseURL 重新带回代码或 docs。

## Prevention

- 新接入 OpenAI-compatible 端点时，不要只验证 `/v1/models`；至少把“模型发现成功”和“图片端点稳定出图”当成两个独立检查项。
- 不把具体 baseURL、私有域名、临时 key 或端点专属参数矩阵写进仓库文档和默认代码。
- 在 request builder 层明确区分“字段值为 auto”和“字段应该被省略”，不要把 UI 语义直接等同于 API 语义。
- 保留针对性回归测试，覆盖请求构造、响应归一化、错误提示脱敏和 dev proxy 路径拼接。
- 实测矩阵如果明显依赖 key 或上游配置，只能作为本地排查记录，不应进入通用项目文档。

## Related Issues

- 浏览器直连第三方 provider 还会受到 `CORS` 限制；本地 dev proxy 只能解决浏览器访问边界，不能证明上游图片接口完全兼容。
- 相关背景文档：
  - `docs/brainstorms/2026-04-27-openai-compatible-image-workbench-requirements.md`
  - `docs/plans/2026-04-27-001-feat-openai-image-workbench-plan.md`
