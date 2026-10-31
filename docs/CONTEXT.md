# TradeFrame context

TradeFrame is a local-first Electron/React/TypeScript trading journal. Target
platforms are Linux, Windows and macOS; real native acceptance is still open.
The owner requested downloadable builds, Obsidian/Dropbox/OneNote connections,
simultaneous destinations and multiple screenshots per setup on 30 October 2026.
The original Super+Ctrl+j script was inspected as a workflow reference only;
no private journals or account data were opened.

## Implemented state

- Floating capture bar, native source snapshots, source selection, up to 20
  ordered screenshots per setup, required per-image timeframes, optional captions, capture timestamps and removal.
  The journal stays visible; the mapped bar becomes transparent during capture.
- Native image bytes stay in memory behind opaque `tradeframe-image:` URLs.
  IPC updates carry image URLs rather than retransmitting PNG data. Removing a
  screenshot or closing/resetting the journal releases its cached bytes.
- Explicit local save creates a fresh Markdown/PNG folder. Open restores the
  original schema, values and screenshots. New setup resets the draft with a
  confirmation. Closing/reloading a draft prompts before discarding it.
- Append screenshots extends the current saved Markdown file without rewriting
  existing bytes; it requires unchanged existing values/images and a matching
  fingerprint, writes a Markdown backup and stages complete files before a
  durable recovery record. Reopening/retrying resumes only the verified missing
  suffix, waits for live writers and preserves external conflicts. Save copy remains available for changes to earlier fields or images.
- Version-4 Markdown requires a timeframe on every screenshot reference and
  renders it in the image heading. Versions 1–3 remain readable unchanged; missing
  timeframes require an explicit Save copy before appending. Later captures can
  be validated append-only blocks. Unknown or
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
  added. The lockfile was reviewed and adopted; CI uses npm ci. Packaging targets
  Windows x64, Linux x64 and macOS arm64/x64 on four native runners. Each runs
  build/tests and checks the packaged Electron/SQLite runtime. Tag builds prepare
  one draft release only after all jobs and checksums pass; publication stays manual.

## Code ownership

`electron/main.ts` owns windows, trusted IPC, native pickers, image serving and
lifecycle and one process per local profile. Sandboxing/context isolation remain enabled; renderer Node access,
new windows and off-app navigation remain blocked. `preload.ts` exposes only
named commands; form, path, source and value validation remain native.

`journal.ts` owns file persistence and append preservation; `append-store.ts`
owns staged file publication, prepared intents and process-crash recovery; `form-schema.ts`
owns types, validation and Markdown. `schema-store.ts` owns form revisions;
`connections.ts` owns folder delivery and its queue; `onenote.ts` owns OAuth,
secure-token calls and Graph requests. The renderer cannot submit arbitrary
screenshot bytes, filesystem paths or API URLs. [SYNC](SYNC.md) defines delivery
boundaries; [RELEASE](RELEASE.md) defines packaging and publisher setup.

## Verification facts, 30 October 2026

The build and automated tests pass with synthetic PNGs, temporary folders,
SQLite and Electron doubles. Coverage includes multi-image round trips,
append preservation/backups and real child-process interruption/recovery,
folder conflicts/restart/retry, simultaneous
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
Dropbox cloud delivery, OneNote consent/upload and Windows/macOS
execution remain unverified. A successful owner desktop launch on 27 October
applies to the earlier build, not these new workflows.

30 October 2026: the owner confirmed that the installed Debian package starts.
The extracted archive had failed because its chrome-sandbox helper belonged to
the user; installing the Debian package supplies root ownership and mode 4755.
This confirms the current Linux installer launch. Capture, multi-image save/open/
append, layout and actual connected-service delivery still need native acceptance.

The 30 October recovery build passed 59 automated tests. Child processes stop before
image installation, midway through a suffix and after the suffix is complete;
reopening and delivery retry finish exactly once. Live writers are checked through
process liveness and left alone. Old empty records and changed recovery/source
files are preserved for inspection. Hard-link-capable local filesystems are
required. Power-loss and concurrent multi-device writers are not verified.
Downloaded packages now include the explicitly selected public guides/ADRs with
their original relative paths, so README and recovery links remain usable offline.

31 October 2026: read-only inspection of the owner's selected saved setup verified
native multi-image output and append preservation: the complete Markdown backup
remained an exact prefix and no recovery record remained. A subsequent inspection
verified four images and identical Markdown bytes in the source and both selected
local Obsidian/Dropbox test destinations. All image filenames, sizes and SHA-256
hashes match the source, as do the typed field values. Simultaneous folder delivery
is therefore verified. Image contents were not inspected. Visible previews,
reopening inside the UI, actual Obsidian rendering, Dropbox cloud delivery and
OneNote authorization remain unconfirmed by these local folder checks.

31 October timeframe/release update: version 0.2.0 passes the build and 67 tests,
including distinct required image timeframes, legacy appended-file reading,
explicit Save copy, native IPC/save enforcement and OneNote image headings. The
Linux archive and Debian installer were built; embedded Electron 45.0.0/SQLite,
checksums, compiled modules, public contents, offline guide links and Debian
sandbox ownership/mode were verified. The four-runner workflow YAML and shell
syntax were checked. Synthetic release checks reject missing platforms, changed
checksums, mismatched tags and edits to published releases, and allow draft
creation/update. Windows/macOS runner execution and artifacts remain pending
until the owner pushes. No push, release creation or publication occurred here.
Cloud/OneNote account acceptance is deferred at the owner's request. Desktop
layout and native use of the new timeframe controls still need owner acceptance.
