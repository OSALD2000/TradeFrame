# TradeFrame visual direction

Approved direction: Linear-inspired desktop workspace, 26 October 2026.
27 October 2026 owner revision: deeper black surfaces and setup fields below
the image, using the full journal width instead of a narrow inspector.
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
| Canvas #000000, surfaces #060606 / #101010 | Owner's darker revision of the Linear reference | Background / nested surfaces | Blacker canvas with restrained separation and readable text |
| Borders #202020 | Owner's darker revision | Structural edges | Separate navigation, preview, fields, and controls |
| Accent #e4f222 | Linear | Single primary action only | Capture before a preview; Save setup with a preview; disabled actions stay neutral |
| Sans-serif UI, medium weights | Linear | Interface typography | Compact scan-friendly labels; system fallback until a font is bundled |
| Brighter secondary text #a0a5ae | Accessibility adaptation | Readable supporting copy | Improve small-text contrast on the dark canvas |
| Navigation / full-width journal / details below image | Owner's layout revision | Desktop workflow | More room for the chart and setup fields |
| Empty state, no synthetic trade records | Current product scope | Honest state | A transient capture is not a saved setup |
| Compact draggable capture bar | Owner's recorder-tool request | Mouse-operated capture controls | Capture without shortcuts; journal stays visible as requested on 27 October 2026 |
| Capture action switches to Close capture bar while open | Owner's explicit-close request, 27 October 2026 | Existing journal action | Keep controls available across screenshots and allow closing from either window |
| App icon: two candles inside capture corners on a dark tile | Owner's icon request; existing TradeFrame frame/candle motif | App identity, separate from action-color roles | Recognizable mark at small desktop sizes; one acid accent candle |
| Setup form below the preview with adaptive field columns | Owner's request for more input space | Setup details following the image | Fields share available width; notes span the row; narrow windows stack fields |
| Save setup becomes the primary action with a preview | Existing single-primary-action rule | Accent reserved for the next action | Retake and capture controls become neutral while setup details are available |
| Inline form selector and explicit editor below the screenshot | Owner's configurable-input request and existing full-width form | Local setup customization | Edit fields, keys, tags, choices and dependencies without a narrow panel or new navigation |
| Native typed inputs and one primary Save form revision action | Existing compact controls and accent discipline | Form definition editing | Keep labels, ordering and rules visible; validation errors stay beside the editor |

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
The setup form follows the preview at every window size. Its fields use as
many 220px-minimum columns as fit, falling to one column on narrow windows.
The form stays mounted but hidden during source selection to preserve its draft.
The capture bar uses the same surfaces, control radii, and primary-action accent.
Candidate source thumbnails and the preview are real user-triggered snapshots,
not fabricated trading examples. Source selection and preview occupy the central
journal area; there is no separate inspector column.

## Verification

Build/typecheck/startup test must pass. Inspect the rendered desktop and narrow
layout against this lock before calling visual QA complete. A browser preview
checks the renderer only; it does not verify the native Electron window.

26 October 2026: `npm run check` passes with the installed dependencies,
including Electron 45 types. Visual QA is blocked in the agent environment:
the browser security policy rejects local file URLs and local serving was
unavailable. Desktop and narrow-window rendering still need manual inspection.
