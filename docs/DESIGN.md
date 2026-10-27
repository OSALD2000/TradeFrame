# TradeFrame visual direction

Approved direction: Linear-inspired desktop workspace, 26 October 2026.
Research method: Refero Design skill; public Refero Styles pages. Refero MCP
was unavailable. These are interpreted website styles, not official brand guides
or evidence of in-app workflows. No source assets or components were copied.

## Reference lock

Primary: [Linear on Refero](https://styles.refero.design/style/90ce5883-bb24-4466-93f7-801cd617b0d1).
Preserve near-black stepped surfaces, fine borders, compact controls, restrained
sans-serif typography, 6px controls, and one accent reserved for the primary action.
Avoid decorative gradients, large marketing headings, and unrelated colored cards.

Secondary research:
- [Fey](https://styles.refero.design/style/a0630421-7b66-48b4-aa14-6194a3b2c2b9):
  chart-first financial context. Borrow only the priority given to chart content;
  do not import its rounded pills, shadows, or extra accents.
- [Attio](https://styles.refero.design/style/08c8700c-f278-42bc-812e-f60dc6ce996e):
  information hierarchy. Borrow only separation of primary and supporting content;
  do not import its light canvas, blue accent, or display typography.

## Decision ledger

| Decision | Source | Role preserved | Reason |
| --- | --- | --- | --- |
| Canvas #08090a, surfaces #0f1011 / #161718 | Linear | Background / nested surfaces | Quiet depth without decorative shadows |
| Borders #23252a | Linear | Structural edges | Separate navigation, journal, and detail pane |
| Accent #e4f222 | Linear | Single primary action only | Capture in the journal/bar; retake in preview; disabled actions stay neutral |
| Sans-serif UI, medium weights | Linear | Interface typography | Compact scan-friendly labels; system fallback until a font is bundled |
| Brighter secondary text #a0a5ae | Accessibility adaptation | Readable supporting copy | Improve small-text contrast on the dark canvas |
| Navigation / journal / detail layout | User-approved product proposal | Desktop workflow | Browse setups while retaining chart context |
| Context -> Entry -> Outcome | Personal journaling workflow | Review sequence | Connect screenshots to stages of a trade |
| Empty state, no synthetic trade records | Current product scope | Honest state | A transient capture is not a saved setup |
| Compact draggable capture bar | Owner's recorder-tool request | Mouse-operated capture controls | Capture without shortcuts; journal stays visible as requested on 27 October 2026 |
| Capture action switches to Close capture bar while open | Owner's explicit-close request, 27 October 2026 | Existing journal action | Keep controls available across screenshots and allow closing from either window |
| App icon: two candles inside capture corners on a dark tile | Owner's icon request; existing TradeFrame frame/candle motif | App identity, separate from action-color roles | Recognizable mark at small desktop sizes; one acid accent candle |
| Setup form in the existing inspector | Approved save fields and existing journal/detail layout | Supporting detail pane | Keep the selected chart visible while entering its reasoning; inspector moves below on narrow windows |
| Save setup becomes the primary action with a preview | Existing single-primary-action rule | Accent reserved for the next action | Retake and capture controls become neutral while setup details are available |

## App icon

`public/tradeframe-icon.png` is the generated master used by Electron windows,
the macOS development dock, the browser favicon, and the journal brand.
Vite copies it to `dist/`. Installer icons are a future packaging task.
Generated with the built-in image tool on 27 October 2026. Prompt brief:
"One flat TradeFrame desktop app icon: dark rounded tile, transparent outside,
four off-white capture corners enclosing two thick candlesticks, one off-white
and one acid yellow-green; legible at 24px, no text, arrows, glow, or 3D."

Media: real chart screenshots when capture exists. The current empty-state glyph
is a simple code-native candlestick/frame symbol, not a chart or performance claim.
On narrow windows the inspector moves below the journal instead of squeezing it.
The capture bar uses the same surfaces, control radii, and primary-action accent.
Candidate source thumbnails and the preview are real user-triggered snapshots,
not fabricated trading examples. Source selection and preview occupy the central
journal area; the detail pane remains reserved for future setup records.

## Verification

Build/typecheck/startup test must pass. Inspect the rendered desktop and narrow
layout against this lock before calling visual QA complete. A browser preview
checks the renderer only; it does not verify the native Electron window.

26 October 2026: `npm run check` passes with the installed dependencies,
including Electron 45 types. Visual QA is blocked in the agent environment:
the browser security policy rejects local file URLs and local serving was
unavailable. Desktop and narrow-window rendering still need manual inspection.
