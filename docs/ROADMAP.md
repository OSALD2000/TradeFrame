# TradeFrame roadmap

## Clipboard recovery repair, 0.7.9

The owner reports that one TradingView image arrives, Auto stops with a generic
error, and enabling it again immediately fails. Repair the shared native PNG
reader and Auto retry state: temporary empty/missing/read failures keep monitoring
selected, recovery preserves the duplicate guard, canceled baselines cannot
change a newer session, and hard image/capacity failures still preserve the draft.
Verify these boundaries with focused regressions and an isolated external PNG
provider; keep actual TradingView/client and other-OS acceptance explicit.

Implemented: five boundary regressions cover empty-PNG,
read-error, format-list, canceled-baseline and unreadable-activation behavior.
`npm run check` and all 218 embedded-runtime tests pass. An external provider on
private Sway verifies native empty-PNG recovery/restart and duplicate suppression;
1120x760, 640x480 and 680x128 views are inspected. No real clipboard or journal is
used. See [verification scope](RELEASE.md#clipboard-recovery-preview-079).

## Implemented work step: clipboard Auto and per-image editing, 0.7.8

Owner-approved on 5 November 2026: Auto listens for new clipboard images while
selected; the owner triggers the trading app's own image export. Replace the
capture bar's Select area action with Edit image on each draft screenshot.
Existing notes/images must not be overwritten by editing a draft.

- [x] Add validated `setAutoCapture` IPC/preload commands and session-only Auto
      state in `electron/main.ts`/`capture-types.ts`; use Electron's asynchronous
      PNG clipboard API, skip the image present on activation, suppress unchanged
      content, serialize polling, reject invalid/oversized PNGs and cancel late reads
      after stop, draft replacement or window closure. Never request text payloads or auto-save.
- [x] Add trusted per-image `editScreenshot` entry using the existing crop
      surface; commit replaces only that draft image, preserves its metadata and
      requires Save copy for edits to an already saved image. Cancel preserves bytes.
- [x] Update `CaptureBar`, `App`, preload/types and capture-state defaults; expose
      visible Auto status/stop controls and Linux/Windows/macOS export hints. Explain
      that clipboard images cannot be attributed reliably to TradingView.
- [x] Run focused red/green native-boundary regressions, `npm run check`, real
      isolated clipboard/crop/save checks and desktop/narrow rendered inspection.
      Update authoritative guides, legal/privacy draft and both READMEs; package and
      review the preview locally. Leave untested platform/account checks explicit.

## Active owner goal

Build a professional downloadable trading journal, connect it to Obsidian,
OneNote or Dropbox, allow multiple destinations together, and keep multiple
screenshots in the same setup Markdown file like the personal Super+Ctrl+j flow.
The owner authorized implementation of this scope on 30 October 2026, adding
required per-image timeframes and releases for all three systems on 31 October. No public
upload, account registration, real-journal access or signing identity is implied.

On 1 November the owner reported missing OneNote delivery, requested opening
setups from OneNote, and asked for online design research and a more approachable
interface. Preserve all three requirements until actual acceptance.

## Implemented; acceptance still open

1. Multi-image capture with a required timeframe and multiline notes per image,
   removal, save/reopen, New setup and a draft-close
   warning. Append screenshots extends the same saved Markdown with a backup;
   changed earlier fields/images use Save copy. Prepared appends recover after
   process interruption, while external edits remain conflicts. Old formats remain readable.
   The separate Trading journal form adds market date, session, No Trade, result/R
   and calendar folders with readable note names and unique per-note images.
2. Journal-folder preferences and simultaneous Obsidian/Dropbox desktop-folder
   delivery, durable jobs, explicit retry and external-conflict protection.
3. OneNote device sign-in, refresh, encrypted-token calls and multipart pages;
   registration is configurable in-app or bundled with the publisher ID. Existing
   notebooks are listed for explicit selection; new deliveries keep the chosen
   notebook across retries and create its TradeFrame section as needed.
4. Reviewed lockfile, npm ci CI, native package archives, Linux Debian installer,
   checksums, four native packaging jobs (Windows/Linux x64 and macOS arm64/x64),
   packaged runtime checks and one combined draft release gate. Actual Windows/macOS
   artifacts remain pending until the package workflow succeeds.

The shared Create/Open/Connections task flow is implemented using the existing
approved style: draft-preserving navigation, optional form tools, capture/details/
save guidance and destination review. Guided dark is now selected and implemented at the larger scale; rendered QA remains open.

Cloud browsing now opens a separate draft with validated snapshots/PNG resources,
including text/image recovery for older pages. Direct send supports setups saved
before connecting. Per-destination feedback exposes upload failures.
The owner reports 0.6.0 still rejects an import link. 0.6.1 adds documented
resource scopes and redacted path diagnostics to identify the missing shape.
The 0.6.1 diagnostic now identifies OData `users(…)` owner syntax; 0.6.2 parses
and normalizes that observed shape. The owner confirms actual import with 0.6.2.
0.6.3 selects libsecret before startup under Sway; the owner confirms OneNote
stays connected after closing and reopening the app, without repeating sign-in.
Architecture and current verification evidence: [CONTEXT](CONTEXT.md).
File behavior: [JOURNAL](JOURNAL.md). Integration behavior: [SYNC](SYNC.md).
Build and publisher instructions: [RELEASE](RELEASE.md).

0.7.3 added local light/dark chart-region heuristics and direct still-image area
selection. Automated geometry and capture-boundary tests are implemented;
actual crop accuracy, dark/light chart layouts, DPI, pointer/keyboard behavior
and safe fallback on all target desktops still require acceptance. The owner
rejected 0.7.3; 0.7.4 corrects reproduced trendline/sidebar cropping and removes
the explicit resolution cap. Full-screen proportional area selection and exported
quality need owner acceptance. The previously reported output marker did not
recur on the next capture; its cause remains unresolved.

0.7.5 adds explicit per-save destination choices, including no public journal.
Only checked external jobs are queued; private working copies preserve retry and
follow-up data. Automated combinations/preservation checks pass, while actual
checkbox layout, real only-OneNote/only-Obsidian use and restart/retry acceptance
remain open. Capture quality/marker acceptance remains open independently.

5 November browser verification covers desktop/minimum-width rendering and
synthetic destination selection, draft navigation, discard focus/Escape and
reduced motion; see [DESIGN](DESIGN.md#browser-verification-5-november-2026).
Outdated mandatory-local/all-connected-target copy is corrected. The synthetic
browser bridge does not establish native capture, installed launch or actual
folder/cloud delivery. The Linux archive still needs a correctly installed
sandbox helper; host user-namespace restrictions were not relaxed.

5 November native verification extends the browser check to the actual 0.7.7
Electron renderer, preload/IPC, native cropping, SQLite and folder adapters on a
private Linux display. Synthetic-input flows pass save/append/backup/reopen,
historical calendar filing, collisions, multiline image notes, changed filing
rules, draft navigation, native close cancellation and confirmed New setup.
Desktop/minimum-width views are inspected; restart retains form/rules/folders/jobs
and a concurrent launch focuses the existing window. Capture and picker inputs
were simulated, and only a temporary package copy used an existing system
sandbox helper. These results do not close actual capture, installed-package,
real cloud/client/keyring or other-OS acceptance; see
[the evidence and remaining checks](RELEASE.md#native-linux-verification-5-november-2026).

Native Linux follow-up verifies interrupted appends at three real process-kill
boundaries, live-writer protection, unrelated-note access, exact recovery without
duplicates and preserved external edits. Folder failure/retry and conflict
preservation also pass through the UI, including a persisted failed job after
restart. Filesystem pauses, capture input and picker results are instrumented only
in isolated test processes; power-loss, other-OS and actual cloud-client acceptance
remain open. Details share the release-verification section linked above.

The subsequent [native portal check](CAPTURE.md#native-portal-verification-5-november-2026)
adds actual screen capture at 1x through private D-Bus/PipeWire/wlr services.
Full-source/Auto chart/pointer/keyboard crops are pixel-exact; UI save/append,
Escape, source denial, window restoration and capture retry pass without replacing
capture results. Physical/scaled displays, interactive OS source choice and the
owner's marker/quality acceptance remain open independently.

## Required before claiming the goal complete

- Verify the final package and checksum, clean extraction, absence of private
  files, and actual installed/downloaded launch with sandboxing enabled.
- Inspect desktop/narrow layouts, keyboard focus and unsaved-draft preservation
  across Create/Open/Connections. Verify returning from file/cloud open and
  capture selection while another page is active. Execute native form, capture, multiple
  screenshots, calendar filing by historical market date, name collisions,
  long image notes, append, backup/reopen and recovery after terminating the process during append, new
  setup and close-warning flows. Verify that concurrent launches focus one window.
- The owner confirms notebook listing and actual setup upload. Verify the
  remaining account flows, including several images in the chosen notebook,
  refresh/restart, target switching, duplicate retry and disconnect
  using synthetic data and an explicitly chosen account.
- The owner confirmed that setups now save to OneNote. Verify the new import
  fixes on the real account, including
  cloud opening, old/new forms and interrupted multi-request uploads.
- The owner chose guided dark with larger controls and subtle motion. Verify
  its first-use flow, desktop/narrow layout, focus, animations and reduced motion.
- Verify real Obsidian note/image visibility and Dropbox cloud delivery together,
  then unavailable-target retry and external-file conflict behavior.
- Run the package workflow and test each OS/architecture claimed in a release;
  local Linux checks do not prove Windows/macOS behavior.
- Decide the source license, trusted signing/notarization and stable installer
  policy, then present concrete artifacts and limitations for owner publication.
  The owner performs pushes, reviews the combined draft and publishes the release.
  Cloud and OneNote account acceptance is deferred at the owner's request (31 October).

The goal remains active until the required workflows are demonstrated. Missing
native access, account configuration and other-OS evidence are open acceptance
work, not completed features merely because mocked tests pass.

0.7.7 fixes reproduced stale-response token invalidation in OneNote downloads
and uploads, preserving the existing cancellation guards. All 208 tests pass
on Linux and in the embedded Node runtime; actual account/native/platform
acceptance remains open. See [SYNC](SYNC.md#onenote).

0.7.6 updates the existing Electron 45 runtime to 45.2.2 and verifies the actual
packaged version against the pin. A wrong-runtime regression and all 202 tests
pass on Linux, including the full suite under the updated embedded Node. This
does not close native capture/window/keyring/credential or other-OS acceptance.
See [runtime verification](RELEASE.md#runtime-maintenance-076).

5 November release preparation adds [privacy](PRIVACY_DRAFT.md),
[terms](TERMS_DRAFT.md) and [provider](PROVIDER_DRAFT.md) review drafts, plus
[backup/update/removal instructions](DATA.md). Owner identity, licensing,
processing-role/legal review, public hosting and support/security contacts remain
required decisions. These documents do not close the legal or native acceptance
gates, and their presence in preview packages does not make them effective terms.

The 5 November [dependency review](RELEASE.md#dependency-review-5-november-2026)
updates Vite 6.4.2 to 6.4.5 after a reproduced development-server file-access
bypass. The current npm registry audit has no reported vulnerabilities; this
does not close Electron/Chromium runtime review, dependency/asset licensing,
private vulnerability contact or native/platform acceptance.

## Later, only when justified

Saved-setup browsing/search, outcome/R review, two-way merges, direct Dropbox API
OAuth, annotations, remembered crop profiles, statistics and broker/AI features. The requested folder
connection uses Dropbox's desktop client; no direct Dropbox account API is claimed.
No global shortcut is registered: the existing personal Super+Ctrl+j binding stays
owned by the desktop script. TradeFrame is usable through its mouse capture bar.

## Owner-requested first-release preparation, 1 November 2026

Per-destination filing rules and previews, new-note filing snapshots, native
menu auto-hide, the first-use/OneNote guide and the explicit Statistics Coming
soon area implement the requested feature scope. New Trading journal notes with
configured rules use format 6; old notes are unchanged and retain their paths.

Before publication, verify the new block editor and first-use flow in real
windows, per-target Obsidian/Dropbox filing and collision/follow-up behavior,
OneNote round trips for format 6, and each claimed OS package. The placeholder
does not bring statistics implementation into scope. Existing signing/license/
publisher and cross-platform acceptance gates above still apply.
