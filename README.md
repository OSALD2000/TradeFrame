# TradeFrame

Capture the chart. Remember the trade.

A local-first desktop trading journal for Windows, macOS, and Linux.
Inspired by a personal Eww/Sway workflow: capture a chart, describe the setup,
and return to trading. [Deutsch](README.de.md)

## Current stage

The app includes a floating capture bar, screen/window source selection, and
an in-memory screenshot preview with retake/discard controls.
**Setup entries and persistence are not implemented yet.** Native capture and
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
- `npm test`: test the compiled main process using an Electron test double;
  run `npm run build` first. This does not replace a real desktop launch.
- `npm run check`: typecheck, build, and run the startup test.

The current dependency and verification status is maintained in
[CONTEXT](docs/CONTEXT.md). The owner-generated lockfile still needs review and
adoption, followed by the switch to `npm ci` in CI. A successful build does not
replace a real desktop launch.

## Structure

- `electron/main.ts`: desktop window and lifecycle.
- `src/`: React UI and local styles.
- `tests/`: startup checks with an Electron test double.
- `docs/ROADMAP.md`: scope, milestones, decisions, and acceptance criteria.
- `.github/workflows/check.yml`: Windows, macOS, and Linux build checks.

The UI has no Node.js access. The renderer uses context isolation and sandboxing;
external navigation and new windows are blocked. A narrow preload bridge exposes
capture commands; the main process validates callers and source selection.

## Try capture

Click **Capture chart**, then **Screenshot** on the floating bar. Choose the
screen/window if prompted and inspect the preview. **Retake screenshot** returns
to the bar; **Discard** clears the preview. Nothing is saved yet.

See [capture notes](docs/CAPTURE.md) for the Sway floating rule, permissions,
snapshot resolution limits, and manual acceptance checks. No shortcut is needed.

## Direction

The first usable release will capture chart screenshots and store setup notes
as Markdown plus images in a user-selected folder. Obsidian is optional.
Existing journals are not imported or modified by this foundation.

Read the [roadmap](docs/ROADMAP.md) before starting the next milestone.
The approved visual direction and reference roles are in the [design notes](docs/DESIGN.md).
Coding agents start with [AGENTS.md](AGENTS.md); product terminology is defined
in [GLOSSARY.md](GLOSSARY.md). Future Dropbox, Obsidian, and OneNote integrations
are backlog ideas, not implemented features.
There are no installers, signing, automatic updates, cloud accounts, broker
connections, or AI features in this milestone. No license has been selected yet.
