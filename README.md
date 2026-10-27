# TradeFrame

Capture the chart. Remember the trade.

A local-first desktop trading journal for Windows, macOS, and Linux.
Inspired by a personal Eww/Sway workflow: capture a chart, describe the setup,
and return to trading. [Deutsch](README.de.md)

## Current stage

The app includes a floating capture bar, screen/window source selection, and
an in-memory screenshot preview with retake/discard controls. Setup details can
be saved as **Markdown plus PNG in a chosen local folder**. Forms are configurable:
types, required fields, Markdown keys, tags, choices, and conditional inputs.
**SQLite stores only versioned form definitions; setup answers stay in Markdown.**
Exported setups can be opened again; automatic browsing and editing files in
place are not implemented. Native capture and
floating-window behavior still need real desktop testing.
Target platforms are not yet verified desktop releases.

## Develop

Use Node.js 24 LTS (24.15.0 or newer) and npm. On Linux, use a graphical
session with the system libraries required by Electron.

```sh
npm install
npm run check
npm start
```

- `npm start`: build and launch the desktop app.
- `npm run dev`: preview the UI in a browser; this is not the desktop app.
- `npm run typecheck`: check the UI and Electron TypeScript.
- `npm test`: test capture/save IPC with an Electron double and local saves in temporary folders;
  run `npm run build` first. This does not replace a real desktop launch.
- `npm run check`: typecheck, build, and run the tests.

The current dependency and verification status is maintained in
[CONTEXT](docs/CONTEXT.md). The owner-generated lockfile still needs review and
adoption, followed by the switch to `npm ci` in CI. A successful build does not
replace a real desktop launch.

## Structure

- `electron/main.ts`: desktop window and lifecycle.
- `src/`: React UI and local styles.
- `electron/journal.ts`: setup validation and local Markdown/PNG saves.
- `electron/form-schema.ts`: typed form rules and Markdown serialization/deserialization.
- `electron/schema-store.ts`: append-only form revisions in local SQLite.
- `tests/`: native-process doubles and temporary-file save checks.
- `docs/ROADMAP.md`: scope, milestones, decisions, and acceptance criteria.
- `.github/workflows/check.yml`: Windows, macOS, and Linux build checks.

The UI has no Node.js access. The renderer uses context isolation and sandboxing;
external navigation and new windows are blocked. A narrow preload bridge exposes
capture/form/open/save commands; the main process validates callers, definitions,
typed answers, selected files and source selection.

## Try capture

Click **Capture chart**, then **Screenshot** on the floating bar. Choose the
screen/window if prompted and inspect the preview. **Retake screenshot** returns
to the bar; **Discard** clears the preview. The bar stays open after captures;
close it with **Close capture bar** in the journal or **×** on the bar.
To save, fill in **Setup details**, click **Save setup…**, and choose a folder.
Each save creates a separate setup directory. Cancellation preserves the draft;
unsaved drafts are lost when the app closes. See [local setup files](docs/JOURNAL.md).

See [capture notes](docs/CAPTURE.md) for the Sway floating rule, permissions,
snapshot resolution limits, and manual acceptance checks. No shortcut is needed.

## Customize forms

Use **Edit form** or **New form** below the screenshot. Each field has a stable
identity, label, type, Markdown key, optional tags and an optional equality-based
visibility rule. Choice options can add their own tags. Hidden answers remain in
the draft but are excluded from saved files. **Open setup…** restores an explicitly
selected exported setup, its original form revision, and its image.

Definitions live in ignored `data/form-schemas.sqlite`; no setup answers or images
are stored in the database. Markdown carries a schema snapshot, typed answers and
literal tags. Read [local setup files](docs/JOURNAL.md) for format limits, legacy
compatibility, validation and preservation behavior. No extra database dependency
is needed: Node/Electron's built-in SQLite is used.

## Direction

The next steps add review and follow-up screenshots to saved setups. Obsidian
remains optional. Existing journals are not scanned or modified automatically.

Read the [roadmap](docs/ROADMAP.md) before starting the next milestone.
The approved visual direction and reference roles are in the [design notes](docs/DESIGN.md).
Coding agents start with [AGENTS.md](AGENTS.md); product terminology is defined
in [GLOSSARY.md](GLOSSARY.md). Future Dropbox, Obsidian, and OneNote integrations
are backlog ideas, not implemented features.
There are no installers, signing, automatic updates, cloud accounts, broker
connections, or AI features in this milestone. No license has been selected yet.
