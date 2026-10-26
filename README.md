# TradeFrame

Capture the chart. Remember the trade.

A local-first desktop trading journal for Windows, macOS, and Linux.
Inspired by a personal Eww/Sway workflow: capture a chart, describe the setup,
and return to trading. [Deutsch](README.de.md)

## Current stage

The foundation includes an Electron window, a React start screen, TypeScript,
a startup isolation test, and build checks for three operating systems.
**Chart capture, entries, and persistence are not implemented yet.**
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

The initial setup environment could not reach the npm registry. No complete
installation or lockfile is available yet. After a successful `npm install`,
review and commit `package-lock.json` and switch CI to `npm ci`.
Do not treat the initial cache-based build as a verified Electron 45 launch.

## Structure

- `electron/main.ts`: desktop window and lifecycle.
- `src/`: React UI and local styles.
- `tests/`: startup checks with an Electron test double.
- `docs/ROADMAP.md`: scope, milestones, decisions, and acceptance criteria.
- `.github/workflows/check.yml`: Windows, macOS, and Linux build checks.

The UI has no Node.js access. The renderer uses context isolation and sandboxing;
external navigation and new windows are blocked. There is no preload bridge
until a feature actually needs native operations.

## Direction

The first usable release will capture chart screenshots and store setup notes
as Markdown plus images in a user-selected folder. Obsidian is optional.
Existing journals are not imported or modified by this foundation.

Read the [roadmap](docs/ROADMAP.md) before starting the next milestone.
The approved visual direction and reference roles are in the [design notes](docs/DESIGN.md).
There are no installers, signing, automatic updates, cloud accounts, broker
connections, or AI features in this milestone. No license has been selected yet.
