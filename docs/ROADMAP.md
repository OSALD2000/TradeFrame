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

Cloud browsing now opens a separate draft with validated snapshots/PNG resources,
including text/image recovery for older pages. Direct send supports setups saved
before connecting. Per-destination feedback exposes upload failures.
Architecture and current verification evidence: [CONTEXT](CONTEXT.md).
File behavior: [JOURNAL](JOURNAL.md). Integration behavior: [SYNC](SYNC.md).
Build and publisher instructions: [RELEASE](RELEASE.md).

## Required before claiming the goal complete

- Verify the final package and checksum, clean extraction, absence of private
  files, and actual installed/downloaded launch with sandboxing enabled.
- Inspect desktop/narrow layouts and execute native form, capture, multiple
  screenshots, calendar filing by historical market date, name collisions,
  long image notes, append, backup/reopen and recovery after terminating the process during append, new
  setup and close-warning flows. Verify that concurrent launches focus one window.
- The owner reported successful Microsoft connection. Verify real notebook
  discovery/selection, page creation with several images in the chosen notebook,
  refresh/restart, target switching, duplicate retry and disconnect
  using synthetic data and an explicitly chosen account.
- Confirm the missing-delivery problem is resolved on the real account; verify
  cloud opening, old/new forms and interrupted multi-request uploads.
- Choose a workspace direction from the researched options in [DESIGN](DESIGN.md),
  implement it and verify first-use navigation and desktop/narrow layouts.
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

## Later, only when justified

Saved-setup browsing/search, outcome/R review, two-way merges, direct Dropbox API
OAuth, crop/annotations, statistics and broker/AI features. The requested folder
connection uses Dropbox's desktop client; no direct Dropbox account API is claimed.
No global shortcut is registered: the existing personal Super+Ctrl+j binding stays
owned by the desktop script. TradeFrame is usable through its mouse capture bar.
