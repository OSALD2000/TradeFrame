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
| Accent #e4f222 | Linear | Single primary action only | Reserve for capture once implemented; disabled capture stays neutral |
| Sans-serif UI, medium weights | Linear | Interface typography | Compact scan-friendly labels; system fallback until a font is bundled |
| Brighter secondary text #a0a5ae | Accessibility adaptation | Readable supporting copy | Improve small-text contrast on the dark canvas |
| Navigation / journal / detail layout | User-approved product proposal | Desktop workflow | Browse setups while retaining chart context |
| Context -> Entry -> Outcome | Personal journaling workflow | Review sequence | Connect screenshots to stages of a trade |
| Empty state, no synthetic trade records | Current product scope | Honest state | Capture and persistence are not implemented |

Media: real chart screenshots when capture exists. The current empty-state glyph
is a simple code-native candlestick/frame symbol, not a chart or performance claim.
On narrow windows the inspector moves below the journal instead of squeezing it.
No new native APIs, permissions, storage, or dependencies are needed for this change.

## Verification

Build/typecheck/startup test must pass. Inspect the rendered desktop and narrow
layout against this lock before calling visual QA complete. A browser preview
checks the renderer only; it does not verify the native Electron window.

26 October 2026: `npm run check` passes with the installed dependencies,
including Electron 45 types. Visual QA is blocked in the agent environment:
the browser security policy rejects local file URLs and local serving was
unavailable. Desktop and narrow-window rendering still need manual inspection.
