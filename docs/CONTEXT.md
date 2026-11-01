# TradeFrame context

TradeFrame is a local-first Electron/React/TypeScript trading journal. Target
platforms are Linux, Windows and macOS; real native acceptance is still open.
The owner requested downloadable builds, Obsidian/Dropbox/OneNote connections,
simultaneous destinations and multiple screenshots per setup on 30 October 2026.
The original Super+Ctrl+j script was inspected as a workflow reference only;
no private journals or account data were opened.

0.6.3: the owner confirms OneNote opening and the other destinations work with
0.6.2. The owner also confirms sign-in survives closing and reopening 0.6.3.
Before this fix, safe metadata checks showed no saved token
file, a Sway session, and installed libsecret/GNOME Keyring; no secrets were read.
Linux/Sway now selects gnome-libsecret before Electron readiness, preserving
explicit overrides. Unavailable secure storage produces an actionable session-only
message. Existing encryption/persistence formats stay unchanged. The native
Secret Service cannot be inspected from this execution environment; restart
acceptance comes from the owner's report. The separate Electron 45 API replacement
remains open.
Build/typecheck and all 119 tests pass, including pre-readiness provider selection,
platform/explicit-override isolation and secure session-only failure feedback.

0.6.2: the owner supplied the redacted live path rejected by 0.6.1:
`/v1.0/users(…)/onenote/resources/…/$value`. The same error was reproduced before
the fix. Resource parsing now accepts OData owner keys, validates quoted/unquoted
syntax and normalizes to Graph slash-key scope endpoints. Tests cover original
fields/PNGs, percent encoding, doubled apostrophes, and malformed keys. Account
data was not accessed. Live import acceptance remains open; the separate Linux
safeStorage deprecation warning remains with the documented compatibility path.
The build and all 118 tests pass locally; this is not a live account test.

0.6.1 follow-up: the owner reports imports still fail with an unsupported resource
link on installed 0.6.0. The live URL shape remains unknown. A focused regression
reproduces rejection of Microsoft's documented user/group/site resource paths;
downloads now preserve that scope on Graph. Unsupported links expose only a
redacted structural diagnostic, with no account/resource IDs, query values or
credentials. The browser checks connection/notebook prerequisites before listing.

Linux session-only sign-in also has a reproducible provider-initialization bug:
the async encryptor did not initialize the separate sync backend identification.
Linux now initializes and encrypts using the same checked sync keyring provider;
fallback/plaintext storage stays rejected. Windows/macOS keep async encryption,
and existing ciphertext is still read with the compatible async decryption API.
Revisit the Linux compatibility path before Electron 46 removes sync safeStorage.
No credential/settings format migration or cloud page modification is introduced.
Live import, Linux keyring/restart and native UI acceptance remain unverified.
Build/typecheck and all 117 tests pass locally, including scope preservation,
redacted failures, Linux provider initialization/restart and picker prerequisites.

## Implemented state

- Floating capture bar, native source snapshots, source selection, up to 20
  ordered screenshots per setup, required per-image timeframes, optional multiline notes, capture timestamps and removal.
  The journal stays visible; the mapped bar becomes transparent during capture.
- Native image bytes stay in memory behind opaque `tradeframe-image:` URLs.
  IPC updates carry image URLs rather than retransmitting PNG data. Removing a
  screenshot or closing/resetting the journal releases its cached bytes.
- New Trading journal notes share mode/year/month/day folders, using market date,
  readable filenames and unique per-note image IDs. Same-name saves are numbered.
  Earlier/custom forms keep separate Markdown/PNG folders. Open restores the
  original schema, values and screenshots. New setup resets the draft with a
  confirmation. Closing/reloading a draft prompts before discarding it.
- Append screenshots extends the current saved Markdown file without rewriting
  existing bytes; it requires unchanged existing values/images and a matching
  fingerprint, writes a Markdown backup and stages complete files before a
  durable recovery record. Reopening/retrying resumes only the verified missing
  suffix, waits for live writers and preserves external conflicts. Save copy remains available for changes to earlier fields or images.
- Version-5 Markdown adds multiline image sections, calendar identity, familiar
  journal fields/tags and Obsidian classes. Versions 1–4 remain readable unchanged; missing
  timeframes require an explicit Save copy before appending. New and original form definitions remain
  separate; existing schema revisions are not changed. Later captures can
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
  The owner reported successful connection; the owner has confirmed actual setup upload.
  New saves require selection of an existing notebook in Connections. Its ID is
  persisted and pinned to queued jobs; pages use its TradeFrame section. OneNote
  creates a new page per saved delivery, including a follow-up delivery.
- Packaging produces native runtime archives/checksums; Linux also builds a
  Debian installer with a desktop entry and sandbox metadata. No dependency was
  added. The lockfile was reviewed and adopted; CI uses npm ci. Packaging targets
  Windows x64, Linux x64 and macOS arm64/x64 on four native runners. Each runs
  build/tests and checks the packaged Electron/SQLite runtime. Tag builds prepare
  one draft release only after all jobs and checksums pass; publication stays manual.

## Code ownership

The implemented pattern inventory, SOLID review rules and approved responsibility
extraction are in [ARCHITECTURE](ARCHITECTURE.md). The pinned formatter and shared
development conventions are in [CODE_STYLE](CODE_STYLE.md). The formatting step
preserves the accepted 0.6.3 behavior and existing directories; structural changes
still require the owner's decision.

The owner approved extracting pure OneNote resource URL validation and the shared
safe error into `onenote-resource.ts` and `onenote-error.ts` inside `electron/`.
The existing error export remains compatible; the delivery queue no longer imports
the Microsoft client for its error type. Authentication and HTTP ownership stay
unchanged. All 122 tests and 47 before/after resource comparisons pass.

Renderer component contracts now use smaller capabilities derived from the existing
`CaptureAPI`. The five affected consumers and their parent/child requirements
compile successfully; unrelated operations are rejected by compile checks. All
17 emitted files remain byte-identical, and the 122 tests pass. No public bridge,
persistence, account or UI behavior changes are introduced by this step.

The owner subsequently approved separating draft workflows into `src/useSetupForm.ts`
while `SetupForm.tsx` retains markup. The hook receives only draft capabilities
and an injected field factory; it imports no view components. Eight workflow
characterizations pass before/after, all 130 tests pass, and 30 direct view/command
comparisons agree. Native emitted files remain byte-identical during this step.

Form definitions/value validation now live in `form-definition.ts`; versioned
Markdown/screenshot conversion lives in `setup-document.ts`. `form-schema.ts`
re-exports the established API, retaining all 20 runtime exports and existing
types. The dependency goes from documents to definitions only. All 42 moved
declarations retain their syntax and 35 before/after format/error comparisons
agree, including legacy version 1. No persisted format is migrated.

The owner selected a Simple Factory for deliveries. `createConnector` provides
folder or OneNote adapters through `SetupConnector`; queue processing no longer
selects provider behavior or formats provider errors. The folder-copy function
is unchanged and retains its original export. OneNote uses the existing lazy
client callback, not a newly created account/session. All 134 tests pass, and
14 direct queue comparisons preserve immediate/awaited state, errors, callback
arguments, legacy backup and cancellation. Underlying promises are returned directly.

`electron/main.ts` owns windows, trusted IPC, native pickers, image serving and
lifecycle and one process per local profile. Sandboxing/context isolation remain enabled; renderer Node access,
new windows and off-app navigation remain blocked. `preload.ts` exposes only
named commands; form, path, source and value validation remain native.

`journal.ts` owns file persistence and append preservation; `journal-layout.ts`
owns safe calendar paths and filenames; `append-store.ts`
owns staged file publication, prepared intents and process-crash recovery.
`form-definition.ts` owns form rules, `setup-document.ts` owns Markdown conversion,
and `form-schema.ts` preserves their existing public exports. `schema-store.ts` owns form revisions;
`connections.ts` owns preferences and its delivery queue; connector adapters own transfers.
`onenote.ts` owns OAuth,
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

31 October macOS CI correction: the owner pushed 38d8757 and reported failed
Check tests on macOS. Temporary test paths used `/var/...`, while native folder
selection resolves them to `/private/var/...`. Sync/recovery fixtures now use
canonical roots, matching the app's existing realpath boundary. Native-save tests
also cover selecting a directory alias, and a redirected connected folder must
still fail without writing to its new destination. Production code is unchanged.
The same eight failures were reproduced on Linux with a symlinked TMPDIR;
build and all 68 tests then passed through that alias. This reproduces the path
condition, not macOS execution. A new GitHub run is pending the owner's fix push.

31 October calendar journal work: the owner explicitly selected the entire old
backtesting structure after a read-only inspection of their selected folder.
Only structure and metadata semantics were used; real note text/images were not
copied into source, demos, tests or packages. Trading journal is a separate built-in
form; it adds market date, New York HH:mm time, session, instrument, No Trade,
daily bias, result and signed optional R. Multiline image notes retain their own
timeframes. New version-5 journal notes share mode/year/month/day directories with
readable collision-safe names and UUID images. New recovery locks belong to each
named note; legacy setup.md locks and version-1–4 parsing/rendering are retained.
Folder delivery keeps the same hierarchy and names at both destinations.
The earlier macOS fix 073a04f passed GitHub Check on all three OSes; the new
calendar changes still require their own native CI and owner desktop acceptance.
Details and compatibility decision: [ADR 0004](adr/0004-organize-journals-by-market-date.md).

The calendar build passes typecheck/build and 81 automated tests, including native
IPC with the new form, historical dates, same-day names/collisions, No Trade/R,
long image notes, refused redirected folders, rollback without deleting another
note, both destination trees, preserved version-4 rendering and interrupted
calendar appends at prepared/partial/committed stages. Renamed older notes can
still recover directory-wide lock records. All 81 tests also pass with a symlinked
TMPDIR, reproducing the path-alias condition that affected macOS. No real vault
files were changed. Desktop layout/capture and actual installed 0.3.0 acceptance
remain open; the automated tests do not establish a native Windows/macOS launch.

31 October OneNote recovery patch (0.3.1): the owner reported entering a profile
or directory ID and losing access to the configuration controls after sign-in
failed. The application settings now stay available, prefill the public client
ID, and allow replacement/removal. Removing a custom ID deletes its local config
and encrypted sign-in, cancels pending OneNote deliveries, and falls back to the
bundled publisher ID if present. Other destinations and existing pages remain.
Failed device-code starts return a safe actionable state without exposing raw
Microsoft diagnostics. The native bridge still admits only the trusted journal.
Build and 86 tests pass, including configured/error-state controls, invalid-ID
correction, removal/restart, publisher fallback, credential deletion, malformed
config, network failure and independent pending folder jobs. Actual Microsoft
account consent/upload and desktop visual acceptance remain open.

1 November version-label update (0.3.2): the journal toolbar shows the manifest
version beside the local-first status and keeps it visible at narrow widths.
The renderer imports only the version from package.json; the package builder
uses that same manifest. No journal format, form revision or credential changes
are part of this update. It includes the earlier calendar journal and OneNote
ID correction/removal fixes. Native visual acceptance remains with the owner.

1 November notebook selection (0.4.0): Connections lists existing notebooks after
sign-in with explicit selection and Refresh notebooks. Selection survives secure
restart; disconnect, app-ID changes and new sign-in clear it. Switching targets
or starting a new sign-in cancels pending OneNote jobs without moving existing
pages. New saves without a target stay local with a warning. Missing notebooks
fail without fallback; TradeFrame sections are discovered/created in the selected
notebook, and duplicate checks are scoped to that section. Graph pagination is
restricted to the same collection. Version-2 connection settings preserve an
original version-1 backup on first mutation and prevent older apps from ignoring
notebook IDs. Legacy jobs without an ID retain default-notebook delivery.
Build and 94 tests pass with synthetic data, including native IPC, picker markup,
pagination boundaries, restart, switching/cancellation, section creation, lost
responses and configuration preservation. The owner reported connection success;
actual notebook discovery/upload and desktop/narrow visual acceptance remain open.
See [ADR 0005](adr/0005-pin-onenote-deliveries-to-selected-notebooks.md).

1 November OneNote delivery/opening work (0.5.0): the owner reports notebooks
visible but no saved page. The installed version is 0.4.0. Scoped read-only
inspection of connection job statuses showed only synced folder jobs, no OneNote
job, and no durable token file; no token or real journal content was read. This
does not establish the exact reported failure. The native app may have session-
only credentials or the setup may have been saved before choosing its target.

Concrete code defects: OData filters used form-encoded plus signs for spaces,
and the upload cap used the underlying OneNote 70 MB limit instead of Graph's
4 MB/six-part limits. Filters now use percent spaces; bounded multipart creation
and append requests support 20 images, with validated missing-image retry.
Individual images/details exceeding 3.8 MB fail explicitly without losing the
local save. Queue errors keep safe stage/status/code diagnostics. A separate
per-destination save result and Send saved setup to OneNote remove ambiguity
when connecting after an earlier save.

Open from OneNote lists only TradeFrame pages in the selected notebook and opens
a separate draft. New snapshot attachments carry original Markdown and image
hashes, with original resource bytes validated before loading. Older standard
forms are recovered from labels/values; unknown forms retain full text/images.
Cloud HTML is never rendered, IDs come from the selected list, and resource URLs
are rebuilt on Graph. Existing pages/files stay; saving creates a separate copy.
Snapshot opening does not merge later visible-text/handwriting edits in OneNote.
See [ADR 0006](adr/0006-reopen-cloud-setups-with-validated-snapshots.md).

Build and 103 automated tests pass, covering 20-image round trips, six-part/size
bounds, a lost PATCH response, safe diagnostics, rejected foreign resource URLs,
changed image bytes, disconnect during download, legacy recovery, trusted native
open/send and preservation of a draft/file after failed import. A real account
send/open is still needed to establish resolution of the owner's report.
The requested larger redesign remains pending the owner's reference-direction
choice. Functional browser/save status reuse the approved lock. Local preview
serving was rechecked: listen EPERM, so desktop/narrow rendering remains open.

1 November shared workspace flow (0.5.1): before the optional visual-direction
choice, implement the task structure common to all offered variants using the
existing approved dark design system. App.tsx owns hash-based Create/Open/
Connections navigation; the bootstrap remains in main.tsx. The controlled form
stays mounted while pages hide, so navigating does not reset it. Local and cloud
opening live on Open setup and retain replacement confirmation. Capture events
that need selection return to Create setup. A numbered capture/describe/save
sequence and direct first capture action replace abstract empty-state copy.
Advanced form tools are collapsed; actual destinations and OneNote session/login
status appear before save. No persistence, credential or native API changes.
Build and 108 tests pass. Added checks cover route whitelisting, navigation and
persistent form markup in SSR, safe destination status and native sender trust
with hash routes. Pending capture/form editing is explained before opening
another setup, preventing hidden unfinished work from being replaced. SSR does not establish live draft interaction, focus, layout
or native capture routing; these remain owner acceptance with desktop/narrow QA.
The new visual identity choice remains pending, not silently selected. The last
installed version checked is still 0.4.0, with no new OneNote job; real account
resolution and cloud opening remain unconfirmed. The full owner goal is active.

1 November owner feedback and 0.6.0: the owner installed 0.5.1 and confirms that
setups are now saved to OneNote. The local job list also records a synced OneNote
job, without inspecting real note contents or tokens. Opening lists the setup but
appears empty with no error. The owner selected guided dark, larger text/controls
and subtle micro-interactions; the earlier style-choice blocker is resolved.

A realistic resource regression failed against 0.5.1: modern Graph /content URLs
were rejected by the $value-only resource parser. Both forms now normalize to
the documented authenticated Graph /content endpoint, including allowed legacy
OneNote-host resource paths. Arbitrary hosts, paths and redirects remain blocked.
Local/cloud opening returns the complete capture snapshot with fields. The UI
applies it explicitly, rejects an empty/mismatched response before declaring
success, and ignores stale initial capture replies after an event or restore.
A focused asynchronous test reproduced the stale-reply screenshot loss before
the guard. Unsubscribe now returns void across the narrow context bridge.
The picker shows safe native diagnostics, a specific opening status and readable
titles while retaining opaque IDs for page selection. No local/cloud note format
or credential change is introduced; failed opening preserves the prior draft.

Guided dark now uses 16px base, 30px titles, larger controls/spacing, 44px targets,
560x128 floating capture controls and 120–200ms functional motion with a reduced-
motion override. Route entry returns to the workspace top; typing does not replay
route transitions. Existing black surfaces and lime primary-action roles remain.
The local preview server was rechecked in this resumed session and still fails
with listen EPERM. No sandbox protections were weakened. Automated checks do not
establish native visual quality or prove the owner's cloud import is fixed.

The 0.6.0 build passes 114 tests. Both /content and legacy resource references
restore the original schema/values/PNGs; alias tests verify tokens stay on Graph.
Native local/cloud open responses include their full capture state, unsubscribe
returns void, and hook tests cover stale initial replies, explicit restoration
without an event, and late callbacks after cleanup. Picker tests keep safe native
errors and remove technical delivery IDs from visible titles. A regression was
observed before each resource/state fix. Base text/surface contrast was checked
at minimum 6.89:1; reduced-motion overrides are present in the stylesheet. This
does not replace real rendering, focus, motion or account import acceptance.
