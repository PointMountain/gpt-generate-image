---
title: Results-first 工作台样式层级与移动端可读性修复
date: 2026-05-01
category: ui-bugs
module: gpt-image-workbench
problem_type: ui_bug
component: rails_view
symptoms:
  - 结果优先布局已完成，但页面仍出现视觉层级不清与局部信息密度偏高
  - 关键可交互区域的 focus-visible 提示不够统一，键盘导航识别成本高
  - "E2E 回归阶段一度报错: net::ERR_CONNECTION_REFUSED (127.0.0.1:4173)"
root_cause: logic_error
resolution_type: code_fix
severity: medium
related_components:
  - testing_framework
  - development_workflow
  - tooling
tags: [results-first, workbench, ui, css, design-tokens, focus-visible, mobile, playwright]
---

# Results-first 工作台样式层级与移动端可读性修复

## Problem

第一轮 results-first 重构后，工作台功能已完整，但视觉层级、交互焦点和窄屏可读性仍不一致，导致结果区不够突出、局部区域显得拥挤。

## Symptoms

- 卡片、内层容器、外层面板的阴影/描边权重接近，主次关系不够明确。
- 结果区、历史区、预设区之间信息密度不一致，局部区域显得拥挤。
- `focus-visible` 在按钮、Provider 卡片、详情展开等关键交互上不够统一。
- `<760px` 断点下按钮换行与卡片内部布局可读性下降。
- E2E 回归阶段曾出现 `ERR_CONNECTION_REFUSED`，阻断了验证链路。

## What Didn't Work

- 零散调整单个组件的间距或 hover 样式，无法修正整体层级。
- 一次 E2E 回归因本地服务不可达失败，属于验证链路问题而非样式根因；仅重跑不能稳定解决 (session history)。

## Solution

本次修复集中在 token 与全局样式层，并完成全量回归验证。

1. 收敛设计 token（`src/styles/tokens.css`）：

```css
:root {
  --text-soft: #5f7088;
  --line-soft: rgba(148, 163, 184, 0.18);
  --line-strong: rgba(148, 163, 184, 0.28);
  --accent-soft: rgba(37, 99, 235, 0.1);
  --focus-ring: rgba(37, 99, 235, 0.34);
  --focus-shadow: 0 0 0 4px rgba(37, 99, 235, 0.14);
  --shadow-soft: 0 14px 30px rgba(15, 23, 42, 0.06);
  --shadow-card: 0 6px 16px rgba(15, 23, 42, 0.05);
}
```

2. 在 `src/styles/global.css` 重建层级与密度：

```css
.workbench-frame {
  grid-template-columns: minmax(0, 1fr) minmax(320px, 380px);
  grid-template-areas:
    "gallery rail"
    "composer rail"
    "support support";
  gap: 16px;
}

.workbench-frame__gallery,
.workbench-frame__composer,
.workbench-frame__rail,
.workbench-frame__support {
  box-shadow: var(--shadow-soft);
}

.section-card,
.prompt-editor {
  box-shadow: none;
}
```

3. 统一交互焦点 token 与可见性基线，并为结果卡主预览按钮保留贴边高亮：

```css
.button:focus-visible,
.provider-card__body:focus-visible,
.settings-disclosure summary:focus-visible,
.stack-card__thumb:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}

.result-card__visual:focus-visible {
  outline: 3px solid var(--focus-ring);
  outline-offset: -3px;
}
```

4. 收紧移动端 `<760px`：降低面板 padding、缩小 actions 间距、让按钮在窄屏可稳定换行。

5. 回归验证：`pnpm test`、`pnpm build`、`pnpm test:e2e` 全部通过。

## Why This Works

- 先统一 token，再调整容器与卡片权重，避免了“局部补丁互相打架”。
- 外层面板与内层卡片分层后，结果区视觉焦点自然上移，符合 results-first 目标。
- 焦点样式统一到关键交互，键盘路径可见性显著提升。
- 移动端改为“重排信息流”而非简单缩放，避免了窄屏拥堵。
- 将 E2E 连接问题与样式问题分离处理，减少误判与无效改动。

## Prevention

- UI 精修优先改 token 与全局层级，不先在单组件打补丁。
- 每次涉及样式权重调整，都同时检查：外层面板、内层卡片、移动端断点。
- 每次交互样式改动都要走一遍键盘导航路径，确认 `focus-visible` 连续可见。
- E2E 默认执行 `pnpm test:e2e`（由 `playwright.config.ts` 的 `webServer` 自动拉起/复用服务）；若排查连接拒绝，再单独执行 `pnpm exec vite --host 127.0.0.1 --port 4173` 验证服务可达性 (session history)。
- JS/TS 项目命令统一使用 `pnpm`，避免脚本入口混用导致环境差异 (auto memory [claude])。

## Related Issues

- Related doc: `docs/solutions/integration-issues/openai-compatible-provider-image-generation-compatibility-2026-04-27.md`（低重叠，属邻近背景）
- GitHub issues: 本次未检索到（`gh` 检索在当前环境未完成授权）
