# TradeFrame context

## Product boundary

TradeFrame is a local-first desktop trading journal targeting Windows, macOS,
and Linux. Its initial workflow is chart capture, setup notes, and later review.
The personal Eww/Sway workflow inspired the product; running TradeFrame must
not require that desktop setup or Obsidian.
The reason for this boundary is recorded in the
[local-first decision](adr/0001-local-first-journal.md).

The renderer supports a capture toolbar, source selection, and an in-memory
screenshot preview. Setup details can be saved explicitly as Markdown plus PNG
in a native-dialog-selected folder; see [JOURNAL](JOURNAL.md) for the format and
recovery boundaries. Forms are configurable, versioned in project-local SQLite,
and included as snapshots in Markdown. SQLite contains no setup answers/images.
Explicit opening restores exported Markdown and its sibling PNG, including the
original fixed-field format. Automatic browsing, scanning, and edit-in-place
are not implemented.
The journal remains visible when the capture bar opens and during source
selection/capture; only the bar is made transparent for the snapshot. Screen snapshots
can therefore include the journal.
The bar reappears after each capture attempt and stays open until explicitly
closed from the journal or the bar, or until the app closes. Its logical open
state is shared with the renderer so the journal can offer a close action.
During capture the bar stays mapped with opacity zero and mouse input ignored;
restoring opacity/input avoids compositor repositioning from hide/show. Native
acceptance of transparency and retained placement remains open. No position
is saved across app restarts.
Native capture and window behavior remain unverified on real target desktops.
Intended behavior and
milestone acceptance live in [ROADMAP](ROADMAP.md); visual rules live in
[DESIGN](DESIGN.md), and canonical domain terms live in [GLOSSARY](../GLOSSARY.md).

## Implemented boundaries

- `electron/main.ts` owns the journal/capture windows and application lifecycle. It loads
  the compiled local UI, enables sandbox/context isolation, disables renderer
  Node integration, and blocks new windows and navigation away from the app.
- `electron/preload.ts` exposes named capture, form, open/save commands and a state subscription;
  the main process validates the calling window, main frame, local URL, and
  selected source. No raw IPC, filesystem API, or privileged event reaches the UI.
- `src/` contains the React journal, capture bar, and CSS. It receives temporary
  screenshot images through the bridge; it has no direct journal file access.
- `electron/journal.ts` validates setup fields, creates exclusive per-setup
  Markdown/PNG files and reads explicitly selected setup files. The main process
  owns native pickers, schema storage, and open/save lifecycle.
  `src/SetupForm.tsx` follows the preview at full journal width and retains the
  draft during save errors/cancellation and source selection.
- `electron/form-schema.ts` is shared, platform-neutral validation, dependency
  evaluation, and typed Markdown serialization/deserialization. It preserves
  stable IDs, schema snapshots, field types and whitespace; hidden values are
  excluded from export without mutating the draft.
- `electron/schema-store.ts` owns append-only schema revisions in
  `data/form-schemas.sqlite` using built-in `node:sqlite`. The DB is ignored by
  Git; only definitions are stored. A store is created lazily and closed at quit.
- `src/SchemaEditor.tsx` edits definitions, tags, choices and visibility rules;
  `src/FieldInput.tsx` renders typed controls. No user-provided scripts execute.
- `tests/main.test.cjs` exercises compiled main-process capture and preload
  behavior with Electron doubles and synthetic images. It is not a real desktop
  launch, renderer test, or native capture test.
- `tests/journal.test.cjs` covers validation, serialization, real temporary-file
  saves/reads, non-overwrite behavior, and cleanup after a simulated write failure.
- Form-model/store tests cover typed round trips, dependency rules, old formats,
  revision preservation, real SQLite reopen and stale edits. Server-rendered
  controls check input representations; they do not replace native visual QA.
- Build output belongs in the ignored output directories; edit source files.

## Development facts

Read `package.json` for executable commands. The full check builds before
testing because the main-process test consumes compiled output. The browser
development preview shows only the renderer; the desktop start also launches
Electron. These are different verification environments.

See [CAPTURE](CAPTURE.md) before changing capture/window behavior or performing
native verification. Unsaved screenshots are memory-only; closing the journal clears
them. The floating bar is controlled by mouse; no global shortcut is registered.

## Known verification limits

Electron 45 is installed locally and the current full check has passed against
its types. The owner has approved the visual design. Native operation on all
three target systems has not been verified.

The initial agent environment could not reach the npm registry, serve local
HTTP, or open local file URLs through the browser tool. Those are observed
environment limits, not requirements for future environments.

27 October 2026: the owner confirmed a successful desktop app launch after the
earlier Linux Chromium sandbox helper error. Native capture and the revised
window visibility behavior still need manual acceptance; keep sandboxing enabled.

`package-lock.json` was generated by the owner and is currently untracked;
preserve it pending review and adoption. CI still uses `npm install`. Lockfile
review and the switch to `npm ci` are an outstanding foundation task, not part
of the agent-documentation change.
