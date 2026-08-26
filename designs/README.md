# TokenCanvas visual refactor

Editable source: `token-canvas-workbench.pen`

## Review frames

| Frame | State | Preview |
| --- | --- | --- |
| `c04Uw6` | Desktop welcome and guided first run | `exports/c04Uw6.png` |
| `r0k20o` | Desktop result and recent history | `exports/r0k20o.png` |
| `ojXtO` | Connection drawer and compatibility warning | `exports/ojXtO.png` |
| `XfBgQ` | Recipes and full history | `exports/XfBgQ.png` |
| `T7cVB` | Mobile welcome and guided first run | `exports/T7cVB.png` |
| `Yn6Il` | Mobile result and continue-creating flow | `exports/Yn6Il.png` |

## Direction

- Editorial print-workshop language: warm paper, ZCOOL KuaiLe display type, LXGW WenKai UI and reading copy, yellow and blue accents, varied ink weights, and controlled asymmetry. The two-family system stays playful without sacrificing long-form Chinese readability.
- The original TokenCanvas artwork appears once as a tilted full-art sticker in each desktop brand rail; it is no longer cropped or repeated on the canvas.
- Controls use a small vocabulary of uneven corner radii: large paper surfaces, compact controls, and micro chips. Onboarding and recipe groups are paper-like lists with internal dividers instead of repeated boxed cards.
- Partial strokes are reserved for internal list dividers and major layout boundaries. Every standalone interactive control keeps a complete outline so the hand-drawn treatment never reads as a rendering defect.
- The create form remains compact while the canvas receives most of the desktop width.
- Onboarding is embedded in the real empty state and can be hidden or reopened.
- The welcome headline stays compact so the three real onboarding steps remain the primary canvas content.
- Decorative edition, archive, result, and section-number labels are removed; visible labels now describe an action, state, or destination.
- Result artwork and recipe copy use the same typewriter scene across desktop and mobile states.
- Connection settings, model selection, manual endpoints, and compatibility feedback live in a dedicated drawer.
- “Continue creating” reuses a result as an input without triggering another paid request.
- Legacy-default migration is intentionally invisible; the UI presents only the current recipe model.

## Interaction contract

- Primary actions, mobile controls, onboarding rows, drawer close, and model selectors use at least a 44 px interaction target. Secondary metadata chips are informational and are not treated as controls.
- The four mobile destinations remain visible as label-first tabs. The active tab uses a blue field instead of placeholder square glyphs.
- Generate changes to a disabled `生成中…` state immediately, exposes cancel/progress feedback for work beyond 300 ms, and resolves to explicit success or recoverable error feedback.
- The connection drawer traps focus, closes with Escape or the close control, returns focus to its trigger, and keeps validation errors next to the affected field.
- Press, drawer, and state transitions use 180–240 ms ease-out motion. `prefers-reduced-motion` removes non-essential movement, and loading feedback remains visible without continuous decorative animation.
- Web fonts use `font-display: swap` with a readable Simplified Chinese fallback so the interface never waits on invisible text.

This is the visual approval artifact. Product implementation starts only after explicit approval.
