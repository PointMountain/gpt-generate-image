---
title: TokenCanvas TUI Workbench 集成与代理链路收口
date: 2026-05-10
last_updated: 2026-05-10
category: integration-issues
module: gpt-image-workbench
problem_type: integration_issue
component: tooling
symptoms:
  - "Ink/Pastel 依赖、浏览器全局对象和 Node 文件系统混在一起时，TUI 路径会和浏览器端 React 18 / Vite 边界互相污染"
  - "初版 CLI/TUI 能跑通 happy path，但 code review 继续暴露 dev proxy SSRF、header 转发、配置持久化竞态、历史写入语义和 JSON 输出污染"
  - "URL 型图片下载、模型发现和生成请求对 useProxy 的继承不一致，导致终端和浏览器对同一 baseURL 的行为漂移"
  - "e2e 原先复用 4173 上的现存服务，端口占用或旧代理环境残留时会出现假通过或 ERR_CONNECTION_REFUSED"
root_cause: wrong_api
resolution_type: code_fix
severity: high
related_components:
  - "cli"
  - "tui"
  - "openai-dev-proxy"
  - "proxy-aware-fetch"
  - "terminal-config-store"
  - "terminal-history-store"
tags: [cli, tui, openai, dev-proxy, terminal-config, history, e2e, image-generation]
---

# TokenCanvas TUI Workbench 集成与代理链路收口

## Problem

TokenCanvas 要在同一个仓库里同时提供浏览器工作台和终端工作台。浏览器端固定在 React 18，而终端侧要接入 Ink/Pastel、本地图片读写、终端配置与历史、OpenAI dev proxy 和 `--json` 自动化输出。

初版集成把主链路接上了，但在继续做 `ce-code-review` 后，仍暴露出代理边界、TUI 配置时序、历史写入语义和 e2e 可靠性的问题。如果这些问题不收口，终端 happy path 可以通过，真实自动化和自定义 baseURL 场景仍会出错。

## Symptoms

- 最新 `ink@7` / `pastel@4` 会要求 React 19，和项目现有 `react@18.3.1` 冲突。
- `src/lib/openai/ai-sdk-image-client.ts`、`src/lib/openai/openai-endpoint.ts`、`src/lib/openai/model-discovery.ts` 早期假设浏览器全局对象或浏览器运行时，CLI/TUI 不能直接复用。
- `src/lib/openai/openai-dev-proxy.ts` 最早只按字面 hostname 做私网拦截，并会转发过宽的请求/响应头，自定义兼容端点下存在 SSRF 和 cookie 污染边界。
- `src/cli/app/tui-app.tsx`、`src/cli/app/screens/generation-screen.tsx` 最早把配置写盘当成 fire-and-forget，`/proxy off`、`/baseurl`、`/apikey` 后立刻 `/generate` 可能仍读取旧配置。
- `src/cli/commands/generate.tsx` 的 `--json` 输出最早会混入 Ink loading 文本；`src/lib/openai/node-image-output.ts` 的 URL 下载阶段也没有继承 `useProxy` 或超时。

## What Didn't Work

- 早期 TUI 先走表单式配置，再改成 slash command 工作区，最后才收口成类似 Claude Code 的底部输入框；前两轮形态都没有把“机器可读输出 + CLI 自动化 + proxy 链路”一起纳入验收，所以问题会在后续 review 才集中暴露 (session history)。
- 只把 TUI 界面跑起来不够。最早版本能进入生成流程，但没有证明生成、模型发现、URL 下载、dev proxy 和历史保存对同一份终端配置保持一致。
- 只看 `pnpm test` / `pnpm run build` 不够。原先 `playwright.config.ts` 复用 `127.0.0.1:4173` 上的现存服务，端口被别的 Vite 进程占用时，e2e 结果不可靠。
- 只修单点 bug 不够。review 暴露的是一组跨边界契约问题：dev proxy 安全边界、代理环境变量并发、输出写盘、配置原子写入、历史并发写入、CLI 机器可读输出。这些问题需要沿整条链路一起收口。

## Solution

1. CLI 依赖选择与浏览器 React 版本对齐。当前实现使用 `ink@5.2.1`、`pastel@3.0.0`、`@inkjs/ui@2.0.0` 和 `zod@3.25.76`，避免为了 TUI 升级整个浏览器应用到 React 19。

2. 图片输入和共享 OpenAI 客户端改成运行时中立边界。`src/lib/openai/image-file-adapter.ts` 统一浏览器 `File` 和 Node 本地文件；`src/lib/openai/ai-sdk-image-client.ts`、`src/lib/openai/openai-endpoint.ts` 用 `globalThis` 和显式 transport/fetch 注入隔离浏览器假设。

3. TypeScript 和持久化边界按运行时拆分。`tsconfig.app.json` 排除 `src/cli` 和 Node-only 模块；`tsconfig.node.json` 覆盖 CLI、Node IO、TUI tests 和共享 OpenAI 模块。终端配置、历史分别落到 `src/cli/config/terminal-config-store.ts` 和 `src/cli/history/terminal-history-store.ts` 的独立文件存储。

4. 终端链路继续做 code review 收口：
   - `src/lib/openai/openai-dev-proxy.ts` 增加 DNS 解析后的私网地址拦截，只允许白名单请求头和响应头，避免把 cookie 等浏览器头透传给自定义上游。
   - `src/lib/openai/proxy-aware-fetch.ts` 用代理窗口协调 `useProxy=true/false` 请求，避免 `proxy off` 通过临时删 `process.env` 破坏同进程并发请求。
   - `src/lib/openai/node-image-output.ts` 让 URL 下载继承 `useProxy`，补上下载超时和原子文件保留。
   - `src/cli/commands/generate-result.ts` 把“图片已写盘但历史保存失败”降级成 success-with-warning，而不是把整次生成报成失败。
   - `src/cli/config/terminal-config-store.ts` 改成原子写入，并在读取损坏 JSON 时显式报错；`src/cli/history/terminal-history-store.ts` 用锁文件防止并发 history 丢写。
   - `src/cli/io/image-path-input.ts` 在读文件前先按单文件和总大小做限制检查，避免多张超大图先打满内存再在下游报错。
   - `src/cli/app/tui-app.tsx` 和 `src/cli/app/screens/generation-screen.tsx` 把当前会话配置和写盘结果拆开处理：当前会话立刻使用新配置，写盘失败则明确 warning，而不是假装持久化成功。
   - `src/cli/commands/generate.tsx` 在 `--json` 模式下禁掉 Ink loading 文本，保证 stdout 可直接机器解析。

5. e2e 启动链路也一起收口。`playwright.config.ts` 改用独立端口 `127.0.0.1:43173`，执行 `pnpm run build && pnpm exec vite preview --host 127.0.0.1 --port 43173 --strictPort`，并通过 `scripts/run-playwright-e2e.mjs` 清理 localhost 代理环境，避免继承本机代理导致假失败。

## Why This Works

这次真正收口的关键不是“又修了几个 bug”，而是把浏览器工作台、终端工作台、OpenAI 请求层、dev proxy、终端配置/历史、e2e 启动链路都重新按运行时边界划清了。CLI/TUI 不再偷偷依赖浏览器全局，dev proxy 不再把浏览器信任边界原样带给任意自定义上游，终端生成也不再把“配置写盘”“历史保存”这类附属步骤和主结果语义混在一起。

这样浏览器和终端共享的是 OpenAI 参数、结果归一化和模型发现规则，而不是共享不适合跨运行时复用的全局状态或文件系统假设。review 里暴露的并发、代理和失败语义问题，也就能在各自边界内被单独证明和回归覆盖。

## Prevention

- 新增 CLI/TUI 依赖前先检查 peer dependency，避免隐式升级浏览器 React 主版本。
- 共享 OpenAI 模块不能直接依赖 `window`、`File`、localStorage 或 IndexedDB；要通过 `image-file-adapter`、transport builder 或 fetch wrapper 显式过边界。
- 终端配置、历史和输出写盘都按“原子写入 + 并发保护 + 主结果和附属结果分离”处理，不再使用 fire-and-forget。
- `proxy off` 不是单个请求参数，而是整条链路语义；模型发现、生成请求和 URL 下载都要一起验证。
- 机器可读命令必须保持 stdout 干净，像 `--json` 这类模式不能混入 Ink loading 文本或 ANSI 噪声。
- e2e 的稳定性前提是“自己启动并独占端口”，不能把已有本地 Vite 进程当成可信前置条件 (session history)。
- 这类跨运行时改动的最小门禁保持为 `pnpm test`、`pnpm run typecheck:node`、`pnpm run build`、`pnpm run test:e2e`，并在开 PR 前至少做一轮 `ce-code-review`。文档侧再用 `scripts/validate-frontmatter.py` 校验 `docs/solutions/` frontmatter。

## Related

- Related plan: `docs/plans/2026-05-10-003-feat-tokencanvas-tui-workbench-plan.md`
- Related code: `src/cli/main.tsx`
- Related code: `src/cli/commands/generate-result.ts`
- Related code: `src/cli/app/tui-app.tsx`
- Related code: `src/lib/openai/image-file-adapter.ts`
- Related code: `src/lib/openai/node-image-output.ts`
- Related code: `src/lib/openai/openai-dev-proxy.ts`
- Related code: `playwright.config.ts`
- Related doc: `docs/solutions/integration-issues/openai-ai-sdk-image-workbench-integration-fixes-2026-05-09.md`
