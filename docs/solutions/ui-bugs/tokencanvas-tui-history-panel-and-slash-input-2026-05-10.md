---
title: TokenCanvas TUI slash 输入退格与历史面板交互修复
date: 2026-05-10
category: ui-bugs
module: tokencanvas-cli
problem_type: ui_bug
component: tooling
symptoms:
  - "在 TUI 底部输入框里只输入 `/` 后，普通终端退格字符无法稳定退出命令检索态，用户会感觉输入卡住"
  - "最近结果始终常驻在主工作区底部，继续输入 prompt 或调整参数时会长期遮挡可视区域"
  - "终端历史只能被动显示文本，不能通过统一的 `/history` 面板选择条目并直接打开对应图片"
root_cause: logic_error
resolution_type: code_fix
severity: medium
related_components:
  - cli
  - tui
  - history
tags: [tokencanvas, cli, tui, slash-command, history-panel, ink, keyboard-navigation]
---

# TokenCanvas TUI slash 输入退格与历史面板交互修复

## Problem

TokenCanvas 终端工作台已经具备生成、配置和历史记录能力，但命令输入与历史复查交互还停留在“能用但摩擦明显”的阶段。用户一旦误触 `/`、或者想回看最近结果继续挑图，就会遇到删除手感不对、底部视野被长期占用、以及历史条目无法直接打开的问题。

## Symptoms

- 在 `src/cli/app/components/command-input.tsx` 里，普通 `Backspace` / `Delete` 只依赖 Ink 键位对象；部分终端实际送出的 `\u007f`、`\b`、`Ctrl+H` 没被统一识别，导致单独输入 `/` 时像“删不掉”。
- `src/cli/app/tui-app.tsx` 早期无条件挂载 `HistoryScreen`，所以最近结果会一直出现在主工作区底部，输入 prompt 时也不会自动收起。
- `src/cli/app/screens/history-screen.tsx` 最早只是把所有历史条目整块渲染出来，没有选择态、回车确认或打开文件动作。
- 第一次实现 `/history` 后，review 又暴露出半受控选择状态和失败路径测试不足的问题：高亮项与详情项有潜在脱节风险，打开失败分支也缺少回归保护。

## What Didn't Work

- 只在 `CommandInput` 里继续沿用通用 `slice(0, -1)` 不够。它能处理浏览器式删除事件，但不能覆盖终端里真实送出的多个退格字符变体。
- 只把历史数据显示得更“紧凑”不够。底部常驻面板本身就是视野问题，继续优化静态渲染只会减轻症状，不会去掉交互负担。
- 第一次把历史列表接进 `GenerationScreen` 后，`HistoryScreen` 和 `ConfirmableSelect` 一度各自维护一份选择状态；这在当前场景能跑通，但 code review 很快指出它会在 entries 刷新时留下同步风险。
- 第一轮测试只证明了 happy path，不足以保护真实回退语义。比如“没有输出文件”“平台 opener 失败”“单独 `/` 已经真的被删掉”这些都是后续 review 才补强的。

## Solution

这次修复分成四块，一起把命令输入、历史浏览和图片打开的交互收紧。

1. 在 `src/cli/app/components/command-input.tsx` 增加统一删除键判断，显式覆盖终端常见退格输入：

```ts
function isDeleteInput(input: string, key: { backspace?: boolean; delete?: boolean; ctrl?: boolean }) {
  return key.backspace || key.delete || input === '\b' || input === '\u007f' || (key.ctrl && input === 'h');
}
```

然后把单字符删除和整行清除都改成复用这套判断，而不是只依赖 `key.backspace`：

```ts
if ((key.meta && isDeleteInput(input, key)) || (key.ctrl && input === 'u')) {
  setValue(removeCurrentInputLine);
  return;
}

if (isDeleteInput(input, key)) {
  setValue((current) => current.slice(0, -1));
  return;
}
```

2. 把“最近结果”从 `TuiApp` 的常驻底部块移走，改成 `GenerationScreen` 里的显式 `/history` 面板。`src/cli/app/screens/generation-screen.tsx` 新增 `/history` 命令和 `panel === 'history'` 分支；`src/cli/app/tui-app.tsx` 不再直接渲染 `HistoryScreen`，而是把 `historyEntries` 与 `onOpenHistoryEntry()` 回调传给主屏幕。

3. 把 `src/cli/app/screens/history-screen.tsx` 从静态文本输出改成真正的键盘选择面板：
   - 复用 `ConfirmableSelect` 处理上下键移动和回车确认
   - 列表只显示截断后的 prompt/model 标签
   - 详情区只展示当前选中项，避免重新制造一整堵历史输出墙
   - `Esc` 返回命令台

同时把 `ConfirmableSelect` 改成支持受控 `value`，让 `HistoryScreen` 只保留一份 `activeEntryId`，消除“高亮项”和“详情项”双状态同步风险。

4. 新增 `src/cli/history/open-history-file.ts`，把平台 opener 差异关进独立 helper。它先检查文件是否存在，再按平台尝试打开：

```ts
if (platform === 'darwin') {
  return { command: 'open', args: [] as string[] };
}

if (platform === 'win32') {
  return { command: 'cmd', args: ['/c', 'start', '', ''] as string[] };
}

return { command: 'xdg-open', args: [] as string[] };
```

无论打开成功、文件缺失还是 opener 失败，`openHistoryFile()` 都返回结构化结果，`GenerationScreen` 只负责记录 detail 并切回 console，不会把整个 TUI 打坏。

## Why This Works

这次修复真正解决的是“状态边界不清”。

- `CommandInput` 现在不再假设所有终端都会把删除动作映射成同一种按键对象，而是统一吸收常见退格输入，保证 lone slash 的最短回退路径可靠存在。
- 历史记录不再作为常驻 UI 与主输入区竞争空间，而是作为单独的 panel 由 `GenerationScreen` 统一切换，输入态和浏览态边界更清楚。
- `HistoryScreen` 改成单一 `activeEntryId` 驱动后，列表高亮、详情渲染和回车打开都围绕同一状态工作，不会再出现半受控同步问题。
- 图片打开逻辑从屏幕组件里抽出去以后，平台差异、文件缺失和 opener 失败都能被测试精确覆盖，UI 层只消费一致的成功/失败语义。

## Prevention

- 涉及终端键盘输入的交互不要只测浏览器式按键对象；至少补一条 `ink-testing-library` 的真实 stdin 路径，覆盖 `\u007f`、`\b`、回车、方向键等终端原始输入。
- 当一个面板既有“当前高亮项”又有“详情展示项”时，优先收敛成单一状态源，不要让外层 screen 和内层 select 各自维护选择态。
- 像“打开文件”“复制到剪贴板”“调用外部命令”这种平台相关副作用，优先放进独立 helper，屏幕组件只消费结构化结果。
- `/history` 这类面板式交互至少覆盖四条测试：进入面板、切换高亮、成功确认、失败回退。
- 对 CLI/TUI 这类交互修复，最小验证门禁保持为：`pnpm test src/cli/app/components/confirmable-select.test.tsx src/cli/app/components/command-input.test.tsx src/cli/app/screens/history-screen.test.tsx src/cli/app/screens/generation-screen.test.tsx src/cli/history/open-history-file.test.ts src/cli/app/tui-app.test.tsx`、`pnpm run typecheck:node`、`pnpm run build`。

## Related Issues

- GitHub issue: `#10` `fix: Refine CLI command input and history recall`
- Related plan: `docs/plans/2026-05-10-005-fix-cli-history-recall-plan.md`
- Related doc: `docs/solutions/integration-issues/tokencanvas-tui-workbench-integration-notes-2026-05-10.md`
- Related code: `src/cli/app/components/command-input.tsx`
- Related code: `src/cli/app/components/confirmable-select.tsx`
- Related code: `src/cli/app/screens/generation-screen.tsx`
- Related code: `src/cli/app/screens/history-screen.tsx`
- Related code: `src/cli/app/tui-app.tsx`
- Related code: `src/cli/history/open-history-file.ts`
