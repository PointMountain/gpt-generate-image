---
date: 2026-05-10
topic: tokencanvas-readme-brand-refresh
---

# TokenCanvas README Brand Refresh

## Summary

把项目 README 从简短功能清单改成正式仓库介绍，并将产品名从泛化的“AI 出图工作台”收敛为 `TokenCanvas`。README 使用用户提供的图片作为主视觉，围绕本地 OpenAI 图片创作画布建立清晰定位。

---

## Problem Frame

当前 README 只列出能力、启动命令和后续方向，读者能看到项目能做什么，但很难快速理解它为什么存在、适合谁、与 API 调试台或多人平台的边界有什么不同。应用页头仍使用“AI 出图工作台”这类功能描述，缺少可记忆的产品名。

---

## Requirements

**Brand and positioning**
- R1. 项目对外名称使用 `TokenCanvas`，不再把“AI 出图工作台”作为主标题。
- R2. README 必须用一句话说明产品定位：本地浏览器里的 OpenAI 图片创作画布。
- R3. README 必须使用用户提供的图片作为主视觉，并通过仓库相对路径引用。

**Repository README**
- R4. README 必须像正式开源仓库介绍一样组织内容，但章节命名和叙事顺序必须使用中文项目语境，不能照搬参考仓库的英文主题骨架。
- R5. README 必须明确这是本地个人工具，API key、历史和预设默认保存在当前浏览器。
- R6. README 必须明确当前不做多人共享、完整图片编辑器、第三方 provider 兼容测试或聊天式图片 agent 工作流。

**App copy alignment**
- R7. 应用页头必须同步展示 `TokenCanvas`，避免 README 和实际界面出现两个项目名。
- R8. 测试中绑定旧项目名的断言必须同步更新。

---

## Success Criteria

- 新读者打开 README 后，能先理解 `TokenCanvas` 的定位和使用边界，再看到安装和脚本。
- README 的主视觉来自用户提供的图片，且不依赖本机 `Downloads` 路径。
- 应用页头、浏览器标题和 README 的主品牌保持一致。
- README 章节使用中文表达，读起来像 TokenCanvas 自己的介绍，而不是参考仓库的改写版。
- 变更通过针对性测试和构建验证。

---

## Scope Boundaries

- 不修改 OpenAI/AI SDK 图片生成链路。
- 不重做 UI 样式。
- 不迁移 package name、localStorage key 或 IndexedDB 名称，避免影响已有本地数据。
- 不删除旧历史方案文档里的历史项目名引用。

---

## Key Decisions

- `TokenCanvas` 作为主品牌名：它和用户提供的 Token 消耗主题图片形成记忆点，同时比“AI 出图工作台”更像正式项目名。
- 图片放入仓库资产目录：README 使用相对路径，避免依赖单台机器的下载目录。
- README 使用中文叙事：当前项目和用户协作上下文以中文为主，英文品牌名保留识别度，正文优先服务当前读者。
- README 不沿用参考仓库的章节标题：参考仓库只提供“正式仓库介绍”的质量标尺，不作为结构模板复制。
