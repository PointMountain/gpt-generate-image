# Image workbench UI patterns

这份简报为 TokenCanvas 的 Pen 视觉稿提供交互参考。它只提取成熟产品的结构模式，不复制竞品品牌资产、颜色、字体或页面构图。

## Midjourney: prompt close to the creation feed

[Midjourney Creating on Web](https://docs.midjourney.com/hc/en-us/articles/33390732264589-Creating-on-Web) 把 Imagine bar 放在 Create 页最容易触达的位置，并让生成结果持续进入中央 creation feed。设置藏在 prompt bar 的单一入口中；每组结果旁保留 prompt、参数和参考图，并提供 rerun、use text/images 和更多操作。

TokenCanvas 可以借鉴：

- 生成入口在长表单滚动时仍然可见。
- 结果旁只保留与下一轮真正有关的动作。
- 参数按需展开，但当前有效状态必须有摘要。
- `Cmd/Ctrl + Enter` 适合高频创作；TokenCanvas 仍保留显式生成按钮和禁用原因。

不照搬：Midjourney 的社交 feed、文件夹、个性化和大量悬停动作超出本轮范围。

## Adobe Firefly: model-aware settings and explicit reuse

[Firefly text-to-image guide](https://helpx.adobe.com/ae_en/firefly/web/work-with-images/generate-images/generate-images-from-text-descriptions.html) 明确指出生成设置会随模型变化。结果支持 `Use settings` 与 `Generate more` 两种不同复用途径；[Firefly workspace overview](https://helpx.adobe.com/firefly/web/get-started/access-the-app/firefly-workspace-overview.html) 则把 Generation history 放在独立的 Files 工作区。

TokenCanvas 可以借鉴：

- 模型能力直接控制可选参数，不把非法组合交给 API 才报错。
- 当前结果与历史记录分开，但都能返回创作工作台继续迭代。
- “继续创作”必须明确恢复了什么，不保留无效果的按钮。

不照搬：Firefly 的多媒体产品导航、订阅入口和深色资产管理系统不适合本地单人工作台。

## Recraft: canvas first, prompt panel adapts to context

[Recraft Prompt panel](https://www.recraft.ai/docs/recraft-studio/image-generation/prompt-panel) 会根据没有选中、单个对象和多个对象三种状态，在生成、编辑和参考模式间改变行为；面板可以停靠在画布底部或侧边。[Recraft Canvas](https://www.recraft.ai/docs/recraft-studio/work-area/canvas) 把画布定义为主要工作面，只有选中对象时才出现相关上下文操作。

TokenCanvas 可以借鉴：

- 文生图、图生图、mask 不是三套页面，而是同一创作控制区的上下文状态。
- 结果画布保持主导地位，只有与当前结果相关的操作才靠近作品。
- 输入素材改变时，模式和引导文字同步变化。

不照搬：无限画布、对象排列、缩放和矢量编辑属于完整设计工具，不进入本轮。

## Ideogram: generation and iteration share one visual surface

[Ideogram Canvas Generate and Remix](https://docs.ideogram.ai/canvas-and-editing/canvas/generate-and-remix) 把生成结果直接放到 Canvas，并允许围绕已存在图片继续 remix；[Canvas overview](https://docs.ideogram.ai/canvas-and-editing/canvas/canvas-overview) 强调生成窗口与选区共同决定下一步操作。

TokenCanvas 可以借鉴：

- 结果出现后，欢迎状态立刻让位给作品和下一轮入口。
- “继续创作”把结果变成输入素材，但不自动触发新的付费生成。

不照搬：TokenCanvas 不增加无限画布、选区窗口或自由排版能力。

## Pen direction for TokenCanvas

### Structure

- Desktop: a fixed brand strip with the full TokenCanvas illustration, a left control column with `创作 / 配方`, and a dominant right canvas with `当前 / 历史`.
- Connection: a drawer for API key, model discovery/manual ID, baseURL and proxy. The workbench shows the active model as read-only state.
- Mobile: one-column flow ordered as connection status, active creation controls, sticky submit, current result, then history/recipes on demand.

### Visual language

- Editorial print workshop: warm paper ground, strong black typography, one or two saturated spot colors, visible rules/registration marks and controlled asymmetry.
- Preserve `assets/tokencanvas-hero.png` unchanged. Use the complete illustration in the fixed brand strip; derive separate cropped/halftone motifs for the welcome canvas.
- Keep the result canvas neutral so generated images, not chrome, provide most of the color.
- Avoid generic AI gradients, glow, glass panels, excessive pills, repeated rounded cards, decorative English eyebrows and unexplained magic icons.

### Required design frames

1. Desktop welcome state with the real-state three-step guide.
2. Desktop creation state with common parameters visible and advanced parameters summarized.
3. Desktop result state with preview, download and one primary `继续创作` action.
4. Desktop history and recipe tabs.
5. Desktop connection drawer and an incompatible-parameter explanation state.
6. Mobile welcome and mobile result/continue-creation states.

No product code is written until these Pen frames are reviewed and accepted.
