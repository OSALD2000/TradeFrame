# TradeFrame context

TradeFrame is a local-first Electron/React/TypeScript trading journal. Target
platforms are Linux, Windows and macOS; real native acceptance is still open.
The owner requested downloadable builds, Obsidian/Dropbox/OneNote connections,
simultaneous destinations and multiple screenshots per setup on 30 October 2026.
The original Super+Ctrl+j script was inspected as a workflow reference only;
no private journals or account data were opened.

## Implemented state

- Floating capture bar, native source snapshots, source selection, up to 20
  ordered screenshots per setup, optional captions, capture timestamps and removal.
  The journal stays visible; the mapped bar becomes transparent during capture.
- Native image bytes stay in memory behind opaque `tradeframe-image:` URLs.
  IPC updates carry image URLs rather than retransmitting PNG data. Removing a
  screenshot or closing/resetting the journal releases its cached bytes.
- Explicit local save creates a fresh Markdown/PNG folder. Open restores the
  original schema, values and screenshots. New setup resets the draft with a
  confirmation. Closing/reloading a draft prompts before discarding it.
- Append screenshots extends the current saved Markdown file without rewriting
  existing bytes; it requires unchanged existing values/images and a matching
  fingerprint, writes a Markdown backup and uses exclusive image writes and a
  lock. Save copy remains available for changes to earlier fields or images.
- Version-3 Markdown includes ordered screenshot references; later captures can
  be validated append-only blocks. Versions 1 and 2 remain readable. Unknown or
  contradictory content is rejected. Details: [JOURNAL](JOURNAL.md).
- Forms support eight field types, stable IDs, keys/tags, choices and conditional
  visibility. Only definitions live in SQLite. The DB is now in Electron's
  user-data directory. Development imports all revisions from the old project
  database without changing it. Existing setups retain embedded schema snapshots.
- Connections remembers the journal folder, an Obsidian vault and a Dropbox
  desktop-sync folder. Every save/append delivers to both when connected. Jobs
  survive restart, retry explicitly, and preserve external conflicts. Folder
  destinations extend matching Markdown files only by appending the exact suffix.
- OneNote uses Microsoft device authorization, delegated Notes.ReadWrite and
  offline_access, refresh, encrypted refresh-token persistence where supported,
  multipart pages with all screenshots, and duplicate checks before retrying.
  A publisher Microsoft application ID and live account acceptance are pending.
  OneNote creates a new page per saved delivery, including a follow-up delivery.
- Packaging produces native runtime archives/checksums; Linux also builds a
  Debian installer with a desktop entry and sandbox metadata. No dependency was
  added. The lockfile was reviewed and adopted; CI uses npm ci. A manual package
  workflow builds artifacts on three OS runners without publishing releases.

## Code ownership

`electron/main.ts` owns windows, trusted IPC, native pickers, image serving and
lifecycle. Sandboxing/context isolation remain enabled; renderer Node access,
new windows and off-app navigation remain blocked. `preload.ts` exposes only
named commands; form, path, source and value validation remain native.

`journal.ts` owns file persistence and append preservation; `form-schema.ts`
owns types, validation and Markdown. `schema-store.ts` owns form revisions;
`connections.ts` owns folder delivery and its queue; `onenote.ts` owns OAuth,
secure-token calls and Graph requests. The renderer cannot submit arbitrary
screenshot bytes, filesystem paths or API URLs. [SYNC](SYNC.md) defines delivery
boundaries; [RELEASE](RELEASE.md) defines packaging and publisher setup.

## Verification facts, 30 October 2026

The build and automated tests pass with synthetic PNGs, temporary folders,
SQLite and Electron doubles. Coverage includes multi-image round trips,
append preservation/backups, folder conflicts/restart/retry, simultaneous
Obsidian/Dropbox delivery, trusted image URLs and mocked OneNote authentication
and upload responses. Tests do not authenticate real accounts or capture the
user's desktop. Native permissions/windowing are covered by [CAPTURE](CAPTURE.md).

A clean offline npm ci with install scripts disabled succeeded in /tmp from the
existing cache. This verifies dependency resolution, not a fresh Electron binary
download. npm DNS is blocked in this environment. A Linux archive was built and
its checksum/allowlisted contents inspected. The final Linux archive and Debian
installer were inspected for root ownership/sandbox mode 4755, launcher metadata,
compiled-module hashes, checksums and exclusion of private/development files.

Native Electron and headless Chrome both fail here with sandbox/socket
Operation not permitted. Vite serving fails with listen EPERM. No sandbox or
browser protection was disabled. Rendered desktop/narrow QA, real capture,
installer launch, Dropbox cloud delivery, OneNote consent/upload and Windows/macOS
execution remain unverified. A successful owner desktop launch on 27 October
applies to the earlier build, not these new workflows.
