# TradeFrame visual direction

## Current polish target, 1 November 2026

The owner's latest request is a more professional implementation with richer
micro-interactions throughout. Build directly on the already approved guided-dark
reference lock below. Preserve the black canvas, lime primary-action role,
screenshot-first layout, existing routes, draft ownership and native workflows.
This is a refinement of that chosen direction, not a new visual-language proposal.

Research refreshed against the existing Linear, Fey and Attio Refero style pages,
Linear's [product screens](https://linear.app/features), the bundled Refero motion,
typography and form craft guides, and the official
[animation performance guide](https://motion.dev/docs/performance) and
[Chrome motion guidance](https://developer.chrome.com/docs/modern-web-guidance/guides/ui-behaviors/motion).
The current Fey homepage redirects to an acquisition notice, so the historical
Refero reference supplies only its existing chart-priority role.

| Decision                                                               | Source / role                                 | Implementation target                                                                                 |
| ---------------------------------------------------------------------- | --------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Stepped black surfaces, neutral active navigation, lime primary action | Existing Linear lock and owner choice         | Crisp navigation, clear page hierarchy, quiet structural borders                                      |
| Consistent icon scale and grouped labels                               | Refero form/typography craft; Attio hierarchy | Three equally legible navigation items, clear source/destination identities                           |
| Readable input surfaces and aligned secondary actions                  | Existing full-width form lock                 | 44px targets, visible keyboard focus, stable labels and responsive field columns                      |
| Immediate interactive feedback                                         | Owner's motion request; Refero motion craft   | 120ms hover, focus and press; short card/disclosure/status entrances                                  |
| Controlled visual hierarchy                                            | Motion performance guidance                   | Animate transforms/opacity for entries, retain immediate actions and draft state                      |
| Accessible motion                                                      | Refero craft and Chrome guidance              | Reduced-motion disables movement; only genuine loading loops; no animated typing or artificial delays |

Use existing CSS and native controls; add no animation dependency, remote font,
generated media, fake trading results or additional navigation. Preserve real
screenshots as the product's media. Actual desktop/narrow rendering and motion
must be inspected before visual acceptance; automatic checks alone are insufficient.

The owner's supplied desktop screenshots were inspected as the before-state:
capture preview, open sources, connected destinations, setup fields, native
replacement confirmation and the schema editor. They inform the bounded content
width, consistent navigation icons, clearer input surfaces and destination marks.
These private screenshots are not copied into the repository or distribution.
Native confirmation dialogs retain their existing behavior and system appearance.

Verification of this polish: `npm run check` passes all 144 tests, including four
style-policy checks for contrast, reduced motion, loading-only loops and target
sizes. The five changed view components retain their 11 function prefixes and
105 event/control bindings. All 20 compiled native modules remain byte-identical
to the previous build; controllers, persistence, authentication and production
CSP are unchanged. The generated renderer references and bundled style rules resolve.

Visual acceptance remains **blocked**, not passed. Local serving fails with
`listen EPERM`, and the browser URL policy rejects local-file previews. No
alternate browser route or disabled security was used. The supplied screenshots
are the before-state only. After completely closing the running app, launch
`npm start` from the project to inspect this source build: desktop/narrow layouts,
capture and form editing, Connections, OneNote dialog, focus and reduced motion.
The installed release has not been replaced or rebuilt by this design step.

Current owner choice, 1 November 2026: **guided dark workspace**, approved for
implementation, with larger text/controls and more subtle micro-interactions.
This resolves the pending choice recorded below. Preserve the existing black
canvas, restrained sans-serif, fine stepped surfaces and lime primary action.
Increase readability and spacing rather than adding decorative dashboards.

Implementation lock: 16px base, 32px desktop/28px narrow titles, 14–15px
supporting/control text, 44px targets, 280px-minimum field columns, 248px desktop
navigation and a 1440px maximum content width. Keep screenshot-first content and
full-width details below; previews remain contained with a 55vh/520px height cap.
Use 120ms hover/press feedback, 200ms state entries and 240ms modal entry;
short travel, no spring/bounce. The small empty-state illustration enters once
over 400ms. Only active loading may loop, with explicit text.
Respect prefers-reduced-motion by disabling animation/transition and smooth
scroll. Use the bundled Refero motion guide; no animation dependency or imagery.
Route changes start at the workspace top; typing never replays route animation.

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

| Decision                                                      | Source                                                          | Role preserved                                   | Reason                                                                                     |
| ------------------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| Canvas #000000, surfaces #08090a / #131517                    | Owner's darker revision of the Linear reference                 | Background / nested surfaces                     | Black canvas with restrained separation and readable text                                  |
| Structural borders #282c30, input borders #606874             | Dark reference adapted for control contrast                     | Structural edges / identifiable input boundaries | Keep separators quiet while editable controls remain distinct                              |
| Accent #e4f222                                                | Linear                                                          | Single primary action only                       | Capture before a preview; Save setup with a preview; disabled actions stay neutral         |
| Sans-serif UI, medium weights                                 | Linear                                                          | Interface typography                             | Compact scan-friendly labels; system fallback until a font is bundled                      |
| Secondary text #b3bac4, supporting text #969faa               | Accessibility adaptation                                        | Readable supporting copy                         | Declared text contrast is at least 6.83:1 on the standard dark surfaces                    |
| Navigation / full-width journal / details below image         | Owner's layout revision                                         | Desktop workflow                                 | More room for the chart and setup fields                                                   |
| Empty state, no synthetic trade records                       | Current product scope                                           | Honest state                                     | A transient capture is not a saved setup                                                   |
| Compact draggable capture bar                                 | Owner's recorder-tool request                                   | Mouse-operated capture controls                  | Capture without shortcuts; journal stays visible as requested on 27 October 2026           |
| Capture action switches to Close capture bar while open       | Owner's explicit-close request, 27 October 2026                 | Existing journal action                          | Keep controls available across screenshots and allow closing from either window            |
| App icon: two candles inside capture corners on a dark tile   | Owner's icon request; existing TradeFrame frame/candle motif    | App identity, separate from action-color roles   | Recognizable mark at small desktop sizes; one acid accent candle                           |
| Setup form below the preview with adaptive field columns      | Owner's request for more input space                            | Setup details following the image                | Fields share available width; notes span the row; narrow windows stack fields              |
| Save setup becomes the primary action with a preview          | Existing single-primary-action rule                             | Accent reserved for the next action              | Retake and capture controls become neutral while setup details are available               |
| Inline form selector and explicit editor below the screenshot | Owner's configurable-input request and existing full-width form | Local setup customization                        | Edit fields, keys, tags, choices and dependencies without a narrow panel or new navigation |
| Native typed inputs and one primary Save form revision action | Existing compact controls and accent discipline                 | Form definition editing                          | Keep labels, ordering and rules visible; validation errors stay beside the editor          |

## App icon

`public/tradeframe-icon.png` is the generated master used by Electron windows,
the macOS development dock, the browser favicon, and the journal brand.
Vite copies it to `dist/`. The Linux installer also uses this PNG for its desktop launcher; native Windows/macOS shell branding still needs acceptance.
Generated with the built-in image tool on 27 October 2026. Prompt brief:
"One flat TradeFrame desktop app icon: dark rounded tile, transparent outside,
four off-white capture corners enclosing two thick candlesticks, one off-white
and one acid yellow-green; legible at 24px, no text, arrows, glow, or 3D."

Media: real chart screenshots when capture exists. The current empty-state glyph
is a simple code-native candlestick/frame symbol, not a chart or performance claim.
The setup form follows the preview at every window size. Its fields use as
many 280px-minimum columns as fit, falling to one column on narrow windows.
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

## 30 October 2026 extension

Use the approved Linear direction directly for multiple screenshots and
connections; no new visual system. Screenshots stack in capture order with a
compact heading, Remove action and labeled caption. The chart remains primary;
all setup fields stay below the image list. Save/Append is the single accent action.
Connections uses separated full-width rows, explicit destination paths/status,
neutral buttons and an inline Microsoft code state. The Refero craft reference
on focus states/forms informs native labels, visible keyboard focus, inline
errors and disabled in-flight actions. At narrow widths, destination actions
wrap below their descriptive text. Native/visual acceptance remains open because
browser/Electron startup is blocked here by sandbox/socket restrictions.

31 October extension: each image has a labeled required timeframe input beside
its optional caption, using the existing compact controls and neutral surfaces.
Native suggestions include `1m` and `2m`; custom numeric intervals use the same
input. At narrow widths the two fields stack. Missing timeframes disable save
and show an inline explanation. Legacy images start empty and explain Save copy.
This follows the same locked Linear form hierarchy; no additional style source.

## Calendar journal extension

The owner's selected old journal supplies the content reference: market date,
New York time, session, instrument, direction/model, result/R, and a paragraph
per image. Reuse the locked Linear layout, native labeled controls and existing
full-width form below the images. A multiline screenshot note replaces the short
caption; the required timeframe stays beside it. The new Trading journal form
is selected for new work; earlier/custom schemas remain selectable and unchanged.
Keep neutral surfaces and one accent action. No new navigation or visual system.

OneNote recovery: keep the application settings as a persistent neutral details
section, prefill the saved public client ID and offer Save/Remove actions. Open
it when setup is missing or sign-in fails. The owner's reported hidden-controls
bug supplies the interaction requirement; retain the locked form/focus styling.

Version label: show the manifest version next to the local-first status in the
existing toolbar, using secondary text and tabular digits. It remains visible
when the local-first label is hidden at narrow widths, so installed builds can
be identified immediately. This follows the owner's 1 November version request.

Notebook destination: after Microsoft sign-in, use a labeled native select and a
neutral Refresh notebooks action in the existing Connections section. Show the
selected notebook name and TradeFrame section together. Require an explicit
choice before sending new setups; never imply the notebook name is a free-text
field. Keep setup/retry errors inline. Reuse the locked Linear form/focus styling.

## 1 November usability research and pending redesign

Brief: a desktop trading journal for new users, with an obvious route from chart
capture to saved setup, accessible local/OneNote opening and visible delivery
results. Keep real chart images and existing data. No marketing illustration or
invented trading statistics. Research: public Refero style systems above, plus
[Linear onboarding](https://linear.app/docs/start-guide) and
[Craft organization](https://www.craft.do/organize). Refero MCP remains unavailable.

Three directions were offered; the owner selected the first on 1 November:

1. Guided dark workspace (recommended). Linear owns black stepped surfaces,
   restrained typography, 6px controls and one primary action; borrow only Craft's
   separation of capture and organization. Separate New setup, Open and Connections;
   visible Capture / Describe / Save progress. Reject dense dashboard widgets.
2. Chart-focused dark journal. Fey owns near-black depth, prominent real chart
   media and calm typography; borrow Linear's short action labels. Compact tools
   and a larger preview. Reject decorative gradients and fictional performance.
3. Light organized workspace. Attio owns white/pale-gray surfaces, fine borders,
   compact lists and generous grouping; borrow Craft's clear organization.
   Dark primary buttons, cobalt only for focus/navigation. Reject dense terminal UI.

Do not treat these as three copied apps or mix their token roles. No bitmap
assets are needed. The first direction is now locked above for implementation. Existing approved styles cover the functional
OneNote browser and save-result panel: native modal focus, short task copy,
separate local/service results and a direct retry link. The browser never renders
retrieved HTML. Local preview serving was rechecked and fails with listen EPERM;
rendered desktop/narrow QA remains blocked, not passed by SSR tests.

## Shared task flow before the visual choice

Build target: the existing approved Linear dark design system. This work changes
navigation/content grouping shared by all three offered directions, without
choosing a new palette, typography or visual identity. At that stage the larger style choice was pending; the current owner choice
above supersedes that state. Preserve the black surfaces, 6px controls, accent-only primary
action and full-width fields below real screenshots. Borrow only Craft's
separation of capture and organization and the user's explicit first-use goal.

Route Create setup, Open setup and Connections separately. Keep the form/draft
mounted while navigating; opening or clearing still requires the existing
replacement confirmation. Put file/cloud opening on Open setup, form editing
behind optional customization, and actual destinations before saving. Show the
capture/details/save sequence and a direct first capture action in the empty
state. Automatically return to the setup when a native capture needs attention.
No sample trades, decorative metrics, generated images or extra dependencies.

0.6.0 verification: typecheck/build and 114 tests pass, including import state and
safe picker copy. Declared text/surface contrast was checked (minimum 6.89:1 for
the base palette); reduced-motion overrides are present. This is not a blanket
accessibility or rendered-layout claim. The current preview-server attempt still
fails with listen EPERM. Desktop/narrow, native capture-bar geometry, live focus
and motion/reduced-motion behavior require desktop acceptance; no sandbox or
browser protections were disabled. The owner has confirmed upload with 0.5.1;
new import rendering is not yet confirmed on their account.
