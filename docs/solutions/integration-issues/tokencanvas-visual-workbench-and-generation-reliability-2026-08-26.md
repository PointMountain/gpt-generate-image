---
title: TokenCanvas 视觉工作台与生图可靠性修复
date: 2026-08-26
last_updated: 2026-08-26
category: integration-issues
module: gpt-image-workbench
problem_type: integration_issue
component: web-ui
symptoms:
  - "工作台视觉语言不统一，品牌图重复或遮挡内容，移动端操作目标偏小"
  - "旧历史记录应用创作配方时可能因缺失字段导致页面白屏"
  - "生成 loading、错误提示和连接状态会让用户误判请求状态"
  - "兼容端点返回 No available compatible accounts 时被显示为泛化参数错误"
  - "API key 默认不可见且没有显隐切换，用户无法核对输入"
root_cause: multiple_causes
resolution_type: code_fix
severity: high
related_components:
  - image-workbench-ui
  - history-store
  - ai-sdk-image-client
  - cloudflare-worker
tags: [ui, ux, history, openai-compatible, api-key, cloudflare, playwright]
---

# TokenCanvas 视觉工作台与生图可靠性修复

## Problem

工作台同时存在视觉、持久化和请求边界问题。只修改颜色与圆角不能解决旧历史白屏、参数能力漂移或兼容端点错误误判；只看单元测试也不能证明本地代理和真实浏览器链路可用。

## Root Causes

- 页面缺少统一的视觉 token、组件边界和响应式交互尺寸，品牌图、空状态、loading 与结果画布各自使用不同语言。
- 历史记录直接按当前类型读取，没有把旧记录的缺失字段规范化为当前创作配方。
- OpenAI-compatible 端点只保证接口形状近似；模型列表可见不代表图片账号池有可用容量。
- 设置面板把“key 非空”描述成“可以生成”，混淆了字段已填写和端点已验证。
- 付费 live E2E 如果给第三方 baseURL 设置默认值，会在只提供 key 时把凭据发送到未明确选择的端点。

## Solution

1. 用纸张、墨线、黄色与蓝色 spot color 统一工作台；品牌图只在左侧出现一次。字体、边框、抽屉、引导、loading、结果和移动端导航复用同一套 token，并以 44px 作为触控下限。
2. 在读取历史记录时集中补齐当前配方字段，旧记录恢复到创作条时不再让组件读取 `undefined` 枚举。
3. 将图片输出与遮罩输入规范化放到独立边界，统一尺寸、透明通道和格式恢复规则。
4. 对 `No available compatible accounts` 单独归类，明确说明它来自兼容端点账号池，不是提示词或尺寸造成的。
5. API key 默认保持密码态，只有用户主动点击“显示”才切换为明文；关闭抽屉会自然恢复隐藏状态。
6. live E2E 同时要求 `TOKENCANVAS_LIVE_KEY` 和 `LIVE_OPENAI_BASE_URL`，不为付费凭据预置第三方目标。

## What Did Not Work

- 仅把上游原始英文错误放进折叠详情，会让用户继续修改无关参数。
- 仅通过 `/models` 判断连接可用，不能证明图片路由有额度或账号。
- 只在新记录写入时补字段，不能修复 IndexedDB 中已经存在的旧记录。
- 只验证桌面截图，会漏掉移动端 API key 按钮小于 44px 的问题。

## Prevention

- 所有持久化记录先 normalize，再进入 React 状态。
- 连接状态区只陈述已经验证的事实；字段非空不能写成连接成功。
- 任何携带用户 key 的 live 测试必须显式声明目标 baseURL，不能回退到第三方默认值。
- 视觉改动保留桌面、移动端、键盘、reduced-motion 和最小触控区域 E2E。
- 发布前执行单测、Node typecheck、构建、完整非付费 E2E、package smoke 和 Wrangler dry-run。

## Verification

- `pnpm test`：41 个测试文件、186 条测试通过。
- `pnpm run typecheck:node`：通过。
- `pnpm run build`：通过。
- `pnpm run test:e2e`：50 条通过，14 条需要显式付费 key/baseURL 的 live 矩阵跳过。
- `pnpm run build:package && pnpm run package:smoke`：通过。
- `pnpm exec wrangler deploy --dry-run`：Worker 与静态 assets 打包通过。
- 真实浏览器：`POST /api/openai/images/generations` 返回 200，结果画布新增 1 张图片，浏览器无控制台错误。

## Related Docs

- `docs/solutions/integration-issues/openai-ai-sdk-image-workbench-integration-fixes-2026-05-09.md`
- `docs/solutions/integration-issues/openai-compatible-provider-image-generation-compatibility-2026-04-27.md`
- `docs/solutions/ui-bugs/results-gallery-style-issues-2026-05-01.md`
