# TradeFrame roadmap

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

5 November release preparation adds [privacy](PRIVACY_DRAFT.md),
[terms](TERMS_DRAFT.md) and [provider](PROVIDER_DRAFT.md) review drafts, plus
[backup/update/removal instructions](DATA.md). Owner identity, licensing,
processing-role/legal review, public hosting and support/security contacts remain
required decisions. These documents do not close the legal or native acceptance
gates, and their presence in preview packages does not make them effective terms.

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
