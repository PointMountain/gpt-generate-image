---
title: refactor: Direct workbench UI redesign
type: refactor
status: completed
date: 2026-05-10
---

# refactor: Direct workbench UI redesign

## Summary

把 TokenCanvas 从偏展示型的蓝色卡片控制台，重构为更直接、可操作的本地 OpenAI 图片工作台。页面应把“写提示词、附参考图、生成、复用结果”作为第一屏主路径，并用更克制的软件 UI 视觉系统替代泛化 AI 蓝色审美。

---

## Problem Frame

当前功能已经从 OpenAI-compatible 调试台收敛到 direct OpenAI + AI SDK 图片工作台，但页面结构和样式仍保留了旧控制台痕迹：结果区优先于创作区、设置面板暴露调试字段、全局样式里残留 provider/compatibility 类名，且视觉语言偏蓝色卡片堆叠而不是直接创作工具。

---

## Assumptions

*This plan was authored without a separate confirmation round because the user explicitly requested planning followed by `/ce-work` execution in the same goal. The items below are agent inferences to preserve review visibility.*

- 本次只做前端样式、页面结构和交互可用性重构，不改 OpenAI/AI SDK 请求契约。
- 因项目没有 Tailwind、Framer Motion 或图标库，本次沿用 React + 全局 CSS，不新增 UI/动效依赖。
- `TokenCanvas` 品牌名来自 `docs/brainstorms/2026-05-10-tokencanvas-readme-brand-refresh-requirements.md`，页面文案继续保持一致。
- `baseURL` 仍保留在底层设置模型里，但不作为主操作设置突出展示。

---

## Requirements

- R1. 第一屏优先呈现创作表单和生成动作，让用户不用先扫结果区或长设置面板就能开始操作。
- R2. 视觉系统必须符合软件工具属性：无 serif 主标题、无紫蓝 AI 渐变感、无纯黑，使用单一低饱和 accent 和稳定的中性灰。
- R3. 表单、模式选择、参考图、mask、生成参数必须更像连续操作流，而不是多个松散卡片。
- R4. OpenAI 设置必须突出 API key、模型和保存状态；调试/高级字段不能干扰主路径。
- R5. 结果区必须强化“预览、下载、设为参考图、复用提示词”的直接操作，并保持空状态、加载、错误状态清晰。
- R6. 移动端必须单列稳定，不出现横向溢出；全高容器使用 `100dvh` 语义。
- R7. 删除或收敛旧 provider/compatibility 样式残留，避免新页面继续携带旧产品模型。
- R8. 现有测试必须同步更新，新增或调整覆盖主区域顺序、设置高级区、结果操作和关键状态。

---

## Scope Boundaries

- 不改 `src/lib/openai/ai-sdk-image-client.ts` 的请求映射、错误归一化或 dev proxy 行为。
- 不新增 Tailwind、Framer Motion、Phosphor、Radix 或其他第三方视觉依赖。
- 不实现画布级 mask 绘制、拖拽排序、快捷键系统或多窗口布局。
- 不改 IndexedDB/localStorage key 语义，不做数据迁移。
- 不创建营销落地页；首屏必须仍是实际工作台。

### Deferred to Follow-Up Work

- 图标体系：如果后续愿意引入 `@phosphor-icons/react`，再单独做按钮图标化和工具栏图标规范。
- 高级动效：如果后续引入 Framer Motion，再把结果卡片和面板切换升级为 spring/layout 动效。

---

## Context & Research

### Relevant Code and Patterns

- `src/app/App.tsx` 是页面编排中心，当前 masthead、gallery、composer、rail 都在这里组装。
- `src/components/layout/app-shell.tsx` 和 `src/components/layout/workbench-frame.tsx` 控制全局布局区域。
- `src/styles/tokens.css` 当前使用 `Newsreader` serif display 字体和蓝色 accent，不符合软件 UI 设计约束。
- `src/styles/global.css` 包含主布局、按钮、表单、状态、结果卡片以及旧 provider/compatibility 样式残留。
- `src/features/workbench/generation-form.tsx`、`prompt-editor.tsx`、`reference-image-dropzone.tsx`、`mask-image-dropzone.tsx`、`generation-controls.tsx` 是主操作流。
- `src/features/settings/openai-settings-panel.tsx` 当前把 `baseURL` 放在主网格里，削弱 direct OpenAI 心智。
- `src/features/results/result-gallery.tsx` 和 `result-card.tsx` 已有结果操作入口，可通过布局和文案强化直接复用。

### Institutional Learnings

- 记忆中确认本仓库方向已经从 OpenAI-compatible provider console 收敛到 direct OpenAI + AI SDK image workbench；本次页面重构必须延续这个方向，不回到兼容层调试体验。

### External References

- 未使用外部网页研究。当前任务主要是现有 React/CSS 产品界面重构，用户已指定 `redesign-existing-projects` 与 `design-taste-frontend` 作为设计准则。

---

## Key Technical Decisions

- 沿用全局 CSS 而不是引入新样式系统：项目没有 Tailwind 或 UI 动效依赖，局部 CSS 重构能降低风险。
- 主布局改为 composer-first：桌面端使用创作区主列、结果区侧列、设置/历史/预设下方或次级列的操作型布局，移动端单列按“创作、结果、设置、历史”阅读。
- 软件 UI 字体全量切到 sans：替换 serif display 为 `Geist`/系统 sans 回退，数字使用 tabular figures，避免工作台像 editorial landing page。
- 色彩从高饱和蓝转为石墨中性 + 低饱和青绿 accent：保留可识别操作色，但避免 AI 蓝紫渐变。
- 设置区采用 primary/advanced 分层：API key、model、save 是主路径；baseURL 和超时作为高级设置折叠，保持底层能力但不误导用户。
- 加载状态改为骨架/进度条形态：避免 generic spinner，状态文本给出可执行动作。

---

## Open Questions

### Resolved During Planning

- 是否引入新图标库：不引入。`package.json` 没有图标库，本次不做包管理变更。
- 是否使用 Tailwind：不使用。项目当前为全局 CSS，迁移会扩大范围。
- 是否改变图片生成请求层：不改变。当前目标是页面样式和交互结构。

### Deferred to Implementation

- 最终哪些旧 CSS 类可直接删除：实现时通过 `rg` 和测试确认仍有引用再删除，避免误删历史/预设共用样式。
- 高级设置默认展开还是折叠：实现时以测试和可访问性为准，倾向默认折叠但保留键盘可访问。

---

## Implementation Units

- U1. **Rebuild visual tokens and shell layout**

**Goal:** 建立更克制的软件工具视觉系统，并把全局 shell 调整为稳定的操作型布局。

**Requirements:** R1, R2, R6, R7

**Dependencies:** None

**Files:**
- Modify: `src/styles/tokens.css`
- Modify: `src/styles/global.css`
- Modify: `src/components/layout/app-shell.tsx`
- Modify: `src/components/layout/workbench-frame.tsx`
- Test: `src/app/App.test.tsx`

**Approach:**
- 替换 serif display 字体、蓝色 accent 和 `100vh` shell。
- 使用中性灰背景、低饱和单 accent、轻量分隔线和少量 tinted shadow。
- 桌面布局改为 composer-first；移动端单列，避免横向溢出。
- 清理不再使用的 provider/compatibility 样式残留。

**Execution note:** 先更新 App 布局断言，确认主区域仍可被语义化查找。

**Patterns to follow:**
- 现有 `AppShell`/`WorkbenchFrame` 的区域插槽模式。
- `redesign-existing-projects` 的现有栈内 targeted upgrade 原则。

**Test scenarios:**
- Happy path: App 仍渲染 TokenCanvas、创作区、结果区、OpenAI 设置区。
- Integration: 布局重构后所有主要 landmark/section heading 仍可访问。

**Verification:**
- 页面结构语义不退化，移动端 CSS 有明确单列规则，全局样式不再依赖旧 provider/compatibility 主类名。

---

- U2. **Make the composer the primary direct action surface**

**Goal:** 把提示词、模式、参考图、mask、参数和生成按钮组织成连续操作流，减少卡片割裂感。

**Requirements:** R1, R3, R5, R6

**Dependencies:** U1

**Files:**
- Modify: `src/features/workbench/generation-form.tsx`
- Modify: `src/features/workbench/prompt-editor.tsx`
- Modify: `src/features/workbench/reference-image-dropzone.tsx`
- Modify: `src/features/workbench/mask-image-dropzone.tsx`
- Modify: `src/features/workbench/generation-controls.tsx`
- Modify: `src/features/workbench/generation-actions.tsx`
- Modify: `src/features/workbench/generation-form.test.tsx`

**Approach:**
- 模式选择改成清晰 segmented 操作区，当前模式可一眼识别。
- prompt 区提供更强主操作视觉和紧凑 helper，不把用户拖进说明文字。
- 参考图和 mask 上传区统一为资产条带/缩略图网格，操作按钮更靠近对象。
- 参数区保持可扫描，生成按钮固定在当前表单结尾，具备 hover/active/focus 状态。

**Patterns to follow:**
- 现有 `GenerationForm` 的受控表单边界。
- `design-taste-frontend` 的表单 label-above-input、loading/empty/error/tactile feedback 规则。

**Test scenarios:**
- Happy path: 用户编辑 prompt 后仍触发 `onChangeForm`，点击生成仍触发 `onGenerate`。
- Happy path: 图生图/遮罩模式按钮仍正确切换 mode。
- Edge case: provider capability off 时图生图和遮罩按钮仍禁用。
- Integration: 有参考图时页面显示参考图数量和移除入口。

**Verification:**
- 主表单不用滚动到设置区即可理解下一步操作；键盘焦点和按钮禁用状态仍可见。

---

- U3. **Split OpenAI settings into primary and advanced controls**

**Goal:** 设置面板服务 direct OpenAI 主路径，弱化 baseURL 等调试字段对普通创作流程的干扰。

**Requirements:** R4, R7, R8

**Dependencies:** U1

**Files:**
- Modify: `src/features/settings/openai-settings-panel.tsx`
- Modify: `src/features/settings/openai-settings-panel.test.tsx`
- Modify: `src/styles/global.css`

**Approach:**
- API key、model、保存按钮作为 primary 设置。
- 默认尺寸、质量、格式、背景、压缩作为默认生成参数。
- `baseURL` 和 timeout 放入高级 `<details>`，保留底层能力但不作为 direct OpenAI 首要字段。
- 文案移除兼容 provider 语气，保留“本地浏览器保存”的真实边界。

**Patterns to follow:**
- 现有 settings panel 的受控输入结构。
- `details/summary` 的原生可访问交互。

**Test scenarios:**
- Happy path: API key 输入和保存仍工作。
- Happy path: `baseURL` 存在于高级设置中，而不是主设置说明里。
- Edge case: 旧 provider 配置提示仍出现，但文案引导用户回到 OpenAI key。

**Verification:**
- 主设置面板第一眼只回答“连接哪个 OpenAI 模型、key 是否已填、如何保存”。

---

- U4. **Refine gallery, state surfaces, and result actions**

**Goal:** 让结果区成为创作循环的一部分，而不是被动图片列表；同时升级 loading/empty/error 状态。

**Requirements:** R5, R6, R8

**Dependencies:** U1, U2

**Files:**
- Modify: `src/features/results/result-gallery.tsx`
- Modify: `src/features/results/result-card.tsx`
- Modify: `src/components/status/loading-state.tsx`
- Modify: `src/components/status/empty-state.tsx`
- Modify: `src/app/App.tsx`
- Modify: `src/features/results/result-gallery.test.tsx`
- Modify: `src/styles/global.css`

**Approach:**
- 结果卡片动作按“预览/下载/作为参考/复用提示词”排布，按钮层级更明确。
- 空状态直接指向设置和提示词两个必要前置动作。
- 加载状态使用 skeleton/progress pulse，不使用圆形 spinner。
- 错误状态保留 detail drawer，但文案更短、更可操作。

**Patterns to follow:**
- 现有 ResultGallery/ResultCard 事件回调。
- 现有 ErrorDetailDrawer 的渐进披露模式。

**Test scenarios:**
- Happy path: 点击预览、下载、设为参考图、复用提示词仍调用对应回调。
- Empty state: 无结果时仍有明确标题和下一步文案。
- Loading state: 生成中时显示可取消状态，不出现旧 spinner 文案依赖。

**Verification:**
- 用户能从任何结果直接进入下一轮创作；加载和失败状态不阻断后续恢复动作。

---

- U5. **Validate responsive behavior and finish cleanup**

**Goal:** 完成测试、构建和浏览器验证，确保重构没有破坏现有功能。

**Requirements:** R6, R8

**Dependencies:** U1, U2, U3, U4

**Files:**
- Modify: `tests/e2e/workbench.spec.ts`
- Modify: `src/styles/global.css`

**Approach:**
- 更新 e2e 断言以覆盖 composer-first 页面和设置高级区。
- 运行单元测试、构建和必要的 e2e/浏览器截图验证。
- 检查 CSS 中旧 provider/compatibility 主样式是否仍被使用，确认后删除。

**Patterns to follow:**
- 现有 Playwright workbench 测试的页面启动和查询方式。

**Test scenarios:**
- Integration: 工作台首屏能看到创作区、OpenAI 设置、结果空状态和生成按钮。
- Responsive: 移动视口下主要区域单列呈现且按钮文字不溢出。

**Verification:**
- `pnpm test`、`pnpm build` 通过；浏览器桌面和移动截图无明显重叠、空白或不可操作区域。

---

## System-Wide Impact

- **Interaction graph:** AppShell/WorkbenchFrame 布局变化影响 App 中 gallery/composer/rail 的视觉顺序，但不改变生成、历史、预设回调链。
- **Error propagation:** OpenAI 错误仍通过 `generationError` 和 ErrorDetailDrawer 展示；本计划只调整状态呈现。
- **State lifecycle risks:** 上传参考图和 mask 的 blob URL 清理逻辑不改，布局重构不能引入额外 URL 生命周期。
- **API surface parity:** 组件 props 尽量保持稳定；如需新增文案/状态 props，要同步测试。
- **Integration coverage:** App、GenerationForm、SettingsPanel、ResultGallery 测试覆盖跨组件操作入口。
- **Unchanged invariants:** OpenAI settings store、history store、preset store、AI SDK client 请求契约保持不变。

---

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| CSS 重构误删历史/预设共用类名 | 删除前用 `rg` 查引用，测试覆盖 History/Presets 现有渲染 |
| composer-first 改动影响既有 e2e 选择器 | 保留语义 heading 和按钮文本，更新测试只绑定用户可见行为 |
| 高级设置折叠导致用户找不到 baseURL | 使用明确的 `高级连接设置` summary，并保持可键盘展开 |
| 移动端按钮文字拥挤 | 使用 grid/flex wrap、最小宽度和可换行文字，浏览器截图验证 |

---

## Documentation / Operational Notes

- README 不在本计划范围内；页面品牌继续与已确认的 `TokenCanvas` requirements 保持一致。
- 无生产后端或数据迁移影响；这是本地前端 UI 重构。

---

## Sources & References

- Related requirements: `docs/brainstorms/2026-05-10-tokencanvas-readme-brand-refresh-requirements.md`
- Related prior plan: `docs/plans/2026-05-09-002-refactor-openai-ai-sdk-image-workbench-plan.md`
- Related code: `src/app/App.tsx`
- Related code: `src/styles/tokens.css`
- Related code: `src/styles/global.css`
- Related code: `src/features/workbench/generation-form.tsx`
- Related code: `src/features/settings/openai-settings-panel.tsx`
- Related code: `src/features/results/result-gallery.tsx`
