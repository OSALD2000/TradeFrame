# TradeFrame roadmap

## Product

A desktop trading journal for people who want to record a chart and their
reasoning without interrupting their trading workflow.

Core flow: shortcut -> screenshot -> setup details -> local save -> later review.
Target: Windows, macOS, and Linux. A build passing on an OS does not verify
screen capture, shortcuts, permissions, or installer behavior on that OS.

## Decisions for the foundation

- Electron, React, and TypeScript; no backend service.
- Local files, with Markdown plus images planned for the first usable release.
- Obsidian is optional. No dependency on Sway, Eww, rofi, or a particular broker.
- English UI and commits; English and German READMEs.
- Reuse the personal journal's workflow, not its hard-coded paths or private data.
- Start with one repository and a small UI. Add native bridges only as needed.

## 1. Foundation (current)

Deliverables: safe desktop window, honest empty state, developer commands,
startup test, bilingual READMEs, CI build matrix, and this roadmap.

Acceptance:
- Fresh `npm install` succeeds and produces a reviewed lockfile.
- `npm run check` passes with the declared dependencies.
- `npm start` opens the desktop window in a normal graphical session.
- No existing journal files are read or written.

Implementation and verification facts are maintained in [CONTEXT](CONTEXT.md).
Remaining acceptance work: review/adopt the owner-generated lockfile, switch
CI to `npm ci`, and explicitly record a successful native desktop launch.
GitHub Actions execution remains unverified.

## 2. Capture feasibility

Implement one chart capture with preview and cancellation, controlled through
a small floating bar as requested by the owner. Mouse controls take priority;
no global shortcut is required for this step. Shortcuts may be considered later.

Implementation exists; native acceptance remains open. Use [CAPTURE](CAPTURE.md).
Acceptance: the floating bar, capture, and cancel work on the development Sway/Wayland desktop;
test Windows and macOS separately and record limitations. Do not assume that
screen selection or permission dialogs can be skipped. Document necessary
compositor rules for floating windows explicitly rather than promising universal
always-on-top behavior.

## 3. First saved setup

Choose a journal folder. Capture an image and enter live/backtest, symbol,
direction, model, timeframe, optional New York entry time, and a note.
Confirm the exact fields and file schema before implementation.

Acceptance: Markdown and image survive restart; invalid input is rejected;
existing files cannot be silently overwritten; failures preserve user input.
Test using synthetic setups in temporary folders.

## 4. Follow a setup

Add later screenshots to an existing setup; record outcome and optional R.

Acceptance: the user can choose the correct setup, track multiple timeframes,
and update a trade without losing existing text or images.

## 5. First usable release

Journal list, entry details, basic settings, documented demo, and installers.
Verify installation, permissions, capture, shortcuts, and persistence on each
claimed platform. Decide licensing, signing/notarization, and release process
before publishing binaries. Check package availability and application naming.

## Later, only after deciding the need

Statistics, imports, chart annotations, AI reviews, broker integration, and sync.
Each milestone is agreed and reviewed separately. No release date is promised.

Integration candidates requested by the owner: **Dropbox, Obsidian, and OneNote**.
These are backlog ideas; authentication, data access, sync direction, conflicts,
and transport/API choices are not designed or authorized yet. Read the
[local-first decision](adr/0001-local-first-journal.md) before planning them.
