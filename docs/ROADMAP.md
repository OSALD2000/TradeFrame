# TradeFrame roadmap

## Active owner goal

Build a professional downloadable trading journal, connect it to Obsidian,
OneNote or Dropbox, allow multiple destinations together, and keep multiple
screenshots in the same setup Markdown file like the personal Super+Ctrl+j flow.
The owner authorized implementation of this scope on 30 October 2026, adding
required per-image timeframes and releases for all three systems on 31 October. No public
upload, account registration, real-journal access or signing identity is implied.

## Implemented; acceptance still open

1. Multi-image capture with a required timeframe per image, captions/removal, save/reopen, New setup and a draft-close
   warning. Append screenshots extends the same saved Markdown with a backup;
   changed earlier fields/images use Save copy. Prepared appends recover after
   process interruption, while external edits remain conflicts. Old formats remain readable.
2. Journal-folder preferences and simultaneous Obsidian/Dropbox desktop-folder
   delivery, durable jobs, explicit retry and external-conflict protection.
3. OneNote device sign-in, refresh, encrypted-token calls and multipart pages;
   registration is configurable in-app or bundled with the publisher ID.
4. Reviewed lockfile, npm ci CI, native package archives, Linux Debian installer,
   checksums, four native packaging jobs (Windows/Linux x64 and macOS arm64/x64),
   packaged runtime checks and one combined draft release gate. Actual Windows/macOS
   artifacts remain pending until the owner pushes and the workflow succeeds.

Architecture and current verification evidence: [CONTEXT](CONTEXT.md).
File behavior: [JOURNAL](JOURNAL.md). Integration behavior: [SYNC](SYNC.md).
Build and publisher instructions: [RELEASE](RELEASE.md).

## Required before claiming the goal complete

- Verify the final package and checksum, clean extraction, absence of private
  files, and actual installed/downloaded launch with sandboxing enabled.
- Inspect desktop/narrow layouts and execute native form, capture, multiple
  screenshots, append, backup/reopen and recovery after terminating the process during append, new
  setup and close-warning flows. Verify that concurrent launches focus one window.
- Register the publisher Microsoft app and test real delegated consent, page
  creation with several images, refresh/restart, duplicate retry and disconnect
  using synthetic data and an explicitly chosen account.
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
