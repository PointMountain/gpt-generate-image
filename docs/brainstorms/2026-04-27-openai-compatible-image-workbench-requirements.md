---
date: 2026-04-27
topic: openai-compatible-image-workbench
---

# OpenAI-Compatible Image Workbench

## Problem Frame

The user wants a personal image-generation workbench that can connect to third-party GPT-compatible providers by entering a `baseURL` and `apiKey`, discover available models, let the user choose an image-capable model, and generate images in a fast, creator-friendly workflow.

The product should feel like a lightweight standalone creative tool rather than a developer console. It should prioritize fast iteration, reusable prompts, and visual output handling while still being resilient to imperfect compatibility across third-party providers.

## Requirements

**Connection and Discovery**
- R1. The product must let the user enter, locally persist, and later reuse one or more provider configurations consisting of at least `baseURL` and `apiKey`.
- R2. The product must attempt a standard model discovery flow after the user tests or saves a provider configuration, and present the discovered model list with a clear success or failure state.
- R3. The product must highlight likely image-capable models from the discovered list while still allowing the user to manually choose a different model.
- R4. When standard discovery or standard generation setup fails, the product must offer a compatibility fallback mode that allows the user to continue by manually specifying the model and additional connection details needed to make the provider usable.

**Creation Workflow**
- R5. The primary workflow must optimize for text-to-image generation with the prompt input as the main focal point of the screen.
- R6. The first release must also support reference-image-based generation in the same main workspace, with a clear indication of when reference images are part of the request.
- R7. The product must expose common generation controls that users expect when creating images, such as size, image count, and other model-dependent output options when available.
- R8. Generated images must be previewable immediately and downloadable individually.
- R9. The product must support fast iteration by allowing a generated result to be reused into the next round of creation, such as reusing its prompt context or turning it into a new reference image where supported.
- R10. The product must show clear in-progress, success, and failure states, with concise default messaging and optional expanded details for provider-specific errors.

**Personal Productivity**
- R11. The product must persist a local history of recent generations, including enough context for the user to recognize and reopen prior work quickly.
- R12. The product must support user-defined presets or templates that capture commonly reused creative setups, such as prompt style and preferred generation settings.
- R13. The product must let the user quickly duplicate, edit, and rerun a previous history item or preset instead of rebuilding a request from scratch.

**Trust and Local-Only Use**
- R14. The product must clearly communicate that credentials are stored locally in the browser and that the first release is intended for personal local use.
- R15. Unsupported provider features must fail gracefully. A missing capability should disable or narrow the affected workflow instead of making the whole workbench unusable.

## Success Criteria

- A user can connect at least one OpenAI-compatible image provider using only local configuration and complete a successful image generation flow.
- A user can go from an empty session to a first generated image quickly, without needing external documentation for the main path.
- When a provider is only partially compatible, the product still gives the user a plausible path forward through manual fallback rather than a hard dead end.
- A user can switch back to a previously used provider configuration without re-entering all connection details from scratch.
- Repeated creative work becomes faster over time because history and presets reduce re-entry and reconfiguration work.

## Scope Boundaries

- No server-side proxy, cloud credential storage, or multi-device sync in the first release.
- No multi-user accounts, collaboration, or shared workspace features.
- No localized image editing or inpainting workflow in the first release.
- No commitment to full bespoke support for every provider-specific dialect; the first release focuses on standard compatibility plus a generic fallback path.
- No product emphasis on provider benchmarking or advanced debugging as a primary workflow.

## Key Decisions

- Browser-first product: Build the first release as a browser-based single-page workbench, with desktop packaging considered later.
- Standard-first compatibility: Attempt standard OpenAI-compatible discovery and generation first, then expose compatibility fallback only when needed.
- Creation-first UX: Optimize the product around fast image creation rather than around provider inspection or API debugging.
- First-release capability line: Support text-to-image and reference-image-based generation, but defer localized editing and heavier image-manipulation workflows.
- Local personal-use assumption: Because the tool is for the user's own local use, local browser persistence is acceptable in the first release.

## Dependencies / Assumptions

- Third-party providers will vary in how completely they implement OpenAI-compatible model discovery and image-generation behavior.
- Some third-party providers may reject browser-origin requests because of CORS or similar browser restrictions.
- The exact set of supported generation controls may differ by model and provider, especially for reference-image workflows.

## Outstanding Questions

### Resolve Before Planning

None.

### Deferred to Planning

- [Affects R4][Needs research] What is the smallest compatibility fallback surface that meaningfully improves third-party provider success without turning the product into a debugging console?
- [Affects R7][Needs research] Which generation controls should always be visible, and which should appear only when the selected model/provider likely supports them?
- [Affects R11][Technical] What history retention and cleanup behavior keeps the tool fast and useful without adding unnecessary management complexity?

## Next Steps

-> /ce:plan for structured implementation planning
