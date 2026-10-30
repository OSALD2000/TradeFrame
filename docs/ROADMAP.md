# TradeFrame roadmap

## Active owner goal

Build a professional downloadable trading journal, connect it to Obsidian,
OneNote or Dropbox, allow multiple destinations together, and keep multiple
screenshots in the same setup Markdown file like the personal Super+Ctrl+j flow.
The owner authorized implementation of this scope on 30 October 2026. No public
upload, account registration, real-journal access or signing identity is implied.

## Implemented; acceptance still open

1. Multi-image capture, captions/removal, save/reopen, New setup and a draft-close
   warning. Append screenshots extends the same saved Markdown with a backup;
   changed earlier fields/images use Save copy. Old formats remain readable.
2. Journal-folder preferences and simultaneous Obsidian/Dropbox desktop-folder
   delivery, durable jobs, explicit retry and external-conflict protection.
3. OneNote device sign-in, refresh, encrypted-token calls and multipart pages;
   registration is configurable in-app or bundled with the publisher ID.
4. Reviewed lockfile, npm ci CI, native package archives, Linux Debian installer,
   checksums and a manual Windows/macOS/Linux artifact workflow.

Architecture and current verification evidence: [CONTEXT](CONTEXT.md).
File behavior: [JOURNAL](JOURNAL.md). Integration behavior: [SYNC](SYNC.md).
Build and publisher instructions: [RELEASE](RELEASE.md).

## Required before claiming the goal complete

- Verify the final package and checksum, clean extraction, absence of private
  files, and actual installed/downloaded launch with sandboxing enabled.
- Inspect desktop/narrow layouts and execute native form, capture, multiple
  screenshots, append, backup/reopen, new setup and close-warning flows.
- Register the publisher Microsoft app and test real delegated consent, page
  creation with several images, refresh/restart, duplicate retry and disconnect
  using synthetic data and an explicitly chosen account.
- Verify real Obsidian note/image visibility and Dropbox cloud delivery together,
  then unavailable-target retry and external-file conflict behavior.
- Run the package workflow and test each OS/architecture claimed in a release;
  local Linux checks do not prove Windows/macOS behavior.
- Decide the source license, trusted signing/notarization and stable installer
  policy, then present concrete artifacts and limitations for owner publication.
  The owner performs pushes and release uploads.

The goal remains active until the required workflows are demonstrated. Missing
native access, account configuration and other-OS evidence are open acceptance
work, not completed features merely because mocked tests pass.

## Later, only when justified

Saved-setup browsing/search, outcome/R review, two-way merges, direct Dropbox API
OAuth, crop/annotations, statistics and broker/AI features. The requested folder
connection uses Dropbox's desktop client; no direct Dropbox account API is claimed.
No global shortcut is registered: the existing personal Super+Ctrl+j binding stays
owned by the desktop script. TradeFrame is usable through its mouse capture bar.
