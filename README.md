# TradeFrame

Capture the chart. Remember the trade. [Deutsch](README.de.md)

A local-first desktop trading journal targeting Linux, Windows and macOS.
Inspired by a personal Eww/Sway journal; TradeFrame runs independently of it.

## Current preview

- Opt-in Auto imports new clipboard PNGs from TradingView or other apps and retries temporary read failures; Edit image crops individual draft images.
- Up to 20 screenshots, each with a required timeframe, optional multiline notes and capture timestamp in one setup Markdown.
- Save/reopen, append follow-up screenshots to the same file with a Markdown
  backup and prepared crash recovery, or save a separate copy to change earlier fields/images.
- Trading journal form with market date, New York time, session, instrument,
  direction including No Trade, model, daily bias, result and optional signed R.
  Readable notes and unique images share mode/year/month/day folders.
- Configurable forms: eight input types, keys/tags, choices and visibility rules.
  SQLite holds only versioned definitions; answers stay in Markdown, images in PNG.
- Remembered journal folder and simultaneous Obsidian/Dropbox folder connections,
  with persisted delivery jobs, explicit retry and protection for external edits.
- OneNote device sign-in and multi-image page delivery through Microsoft Graph.
- Packaging targets Windows x64, Linux x64 (also Debian),
  and macOS Apple Silicon/Intel, with SHA-256 checksums. All four builds must pass
  before a draft release is prepared. Windows/macOS artifacts await the first workflow run.

This is an early preview. Build/tests pass; native capture, layout, installer
launch, real cloud delivery and other operating systems still need acceptance.
Packaged builds from 0.7.2 include TradeFrame's public Microsoft application ID:
choose Connect OneNote, sign in and enter the temporary Microsoft code. Existing
saved connections remain in the app profile; app-ID controls stay available as
advanced settings. No public
release or signed/notarized build is claimed. [Current evidence](docs/CONTEXT.md)

## Develop and package

Use Node.js 24.15+ (24.x) and npm; Linux needs Electron's system libraries and a
graphical session. Use a synthetic chart and temporary journal folders for tests.

```sh
npm ci
npm run check
npm start
```

`npm ci` also provisions the pinned Electron runtime through the project's
postinstall hook. If you deliberately disable install scripts, run
`npm exec -- install-electron` explicitly before starting or packaging the app.

`npm run dev` previews the renderer in a browser. `npm run package` runs all checks
and packages the installed Electron runtime into ignored `release/` output. No
Node/npm is needed on the computer running an extracted package. Linux packaging
also requires `dpkg-deb` for the Debian installer. Windows/macOS builds run on
those systems. The archive includes public guides with working relative links.
[Build/download instructions and acceptance](docs/RELEASE.md)

Development conventions: [architecture and implemented patterns](docs/ARCHITECTURE.md)
and [code style and formatting](docs/CODE_STYLE.md).

## Copy chart images with Auto

Enable **Auto**, then use TradingView's **Copy chart image**: Linux/Windows
Ctrl+Shift+S; macOS Cmd+Shift+S, or the chart camera menu. New PNG clipboard images
from any app enter the draft while Auto is on; existing/unchanged content is
ignored. Add a timeframe per image and save explicitly. **Edit image** crops one
draft image; changing a saved image requires Save copy. Stop Auto when finished.
See [capture behavior, limits and verification](docs/CAPTURE.md).

## Journal workflow

The top-right toolbar shows the installed app version, for example `v0.7.9`.

Use the sidebar to switch between **Create setup**, **Open setup** and
**Connections**. Your draft stays in memory when switching pages. Create setup
shows Capture → Describe → Save & send. The guided dark layout uses larger
text, 44px controls and subtle feedback for clicks, loading and opening panels.
Animations respect the system reduced-motion preference. Form selection/editing is under
**Customize the form (optional)**, leaving the first capture in focus.

Enable **Auto** in the journal or floating capture controls, then copy a chart
image from the trading app. Each changed PNG adds a view; the exported image stays
whole. Choose **Edit image** on a screenshot to crop its draft, or Escape to cancel.
Use Save copy after editing an already saved image; source files stay unchanged.
Choose **Timeframe (required)** per image, such as `1m`, `2m` or `1h`, and add optional
multiline notes. The older Trading setup form retains its setup-level Timeframe.
Remove individual draft images or use **Start a new setup** to clear the current setup.
The bar stays open until closed from the journal or with **×**.
Closing it or replacing/opening a setup stops Auto.

Enter **Setup details**, check at least one **Save destination**, then **Save setup**.
Local journal, Obsidian, Dropbox and OneNote are individually optional; only Local
journal is checked initially. Only checked targets receive this save or append.
The first save to Local journal asks for its folder; later saves remember it.
With that target off, a private working copy remains on this device for retries
and follow-ups, without a journal-folder prompt. Choose the parent of `backtesting` and `live`.
The selected Trading journal form saves by **market date**, for example:

```text
backtesting/2025/01/07/
  2025-01-07 0930 TEST Short Example.md
  chart-<note-id>-001.png
```

Capture dates stay separate. Same-name notes receive `(2)`, `(3)`, etc.; images
use a unique note ID. Earlier/custom forms retain their separate `setup.md` folders.
If the journal folder is already inside your Obsidian vault, it is directly
visible there without also connecting that vault as a second destination. **Open setup → Choose a local setup…** restores the complete form and images.
Capture another view and **Append screenshots** to extend that same file while
preserving its original bytes and creating a Markdown backup. Earlier values
and images must stay unchanged; **Save a separate copy** creates a separate note for
those edits. Never use a real journal to test failure/recovery behavior.

Older files still open unchanged. Choose the missing image timeframes and use
**Save a separate copy** once to create a version-5 file; future screenshots can append to
that copy. Timeframes are never guessed from captions or setup fields.

Closing/reloading a populated draft asks before discarding it. A crash can lose
unsaved drafts. Prepared screenshot appends resume when reopened or retried;
foreign edits are kept as conflicts. Recovery and legacy-lock handling are in
[local setup files](docs/JOURNAL.md). [Capture/permissions](docs/CAPTURE.md)

## Connections

Choose destinations in **Connections**. Obsidian and Dropbox can be connected
at the same time, with OneNote optionally added. Explicit saves/appends deliver
only the current setup; no journal scan or two-way merge takes place.

Obsidian receives portable Markdown/PNG in the chosen vault's `TradeFrame/`
folder. Dropbox receives the same files in a folder managed by its desktop
client, which handles cloud synchronization. TradeFrame does not authenticate
to the Dropbox API or treat a local copy as proof of a cloud upload.

OneNote uses Microsoft consent and creates a page containing fields, tags and
all images in the chosen notebook's TradeFrame section. After sign-in, select it
in **Connections → OneNote → OneNote notebook**. Use **Refresh notebooks** after
creating or opening one in OneNote; its name is unrestricted. The selection
survives restart. Switching notebooks cancels pending OneNote deliveries without
moving existing pages. New saves require a selection. Refresh tokens use
system encryption where supported; otherwise sign-in lasts this session only.
Normal updates keep the profile. If sign-in is session-only, unlock the system
keyring and reconnect; select the notebook again after a new sign-in.
On Linux/Sway, TradeFrame explicitly selects libsecret; the keyring must be running
and unlocked. Connections explains when sign-in could not be kept securely.
A new follow-up delivery creates a new OneNote page; existing pages are preserved.
Failed deliveries survive restart and appear under **Retry sync**. Disconnecting
cancels outstanding deliveries without deleting existing notes or pages.
Save feedback lists the local result and each destination separately. After
connecting, **Send saved setup to OneNote** sends the last saved local version
without creating another local file. Save pending edits first.

Use **Open setup → Browse OneNote setups…** to browse TradeFrame pages in the selected notebook.
Opening restores a draft; save a new local copy to continue. New pages carry a
validated snapshot of their original fields and image references. Older standard
forms are recovered from the page; unknown older forms open as text plus images.
Manual OneNote edits stay on the page; snapshot import restores the originally
sent values. Each image must be below 3.8 MB for Graph; multiple images are sent
in batches. Larger local saves remain available.
[Behavior, conflicts and verification](docs/SYNC.md)

OneNote application settings stay available after failed sign-in. Use **Save application ID**
to replace a custom ID or **Remove custom ID** to reset it; existing pages stay.

## Architecture and limits

Electron owns native capture, files, SQLite, OAuth and the delivery queue. React
has no Node/filesystem access; sandboxing and context isolation stay enabled.
Named IPC commands validate callers and inputs. Image bytes stay in a native
memory cache behind opaque local image URLs. No new application dependency was
added for SQLite, integrations or packaging.

[Roadmap](docs/ROADMAP.md) · [Visual direction](docs/DESIGN.md) ·
[Agent entry point](AGENTS.md) · [Domain language](GLOSSARY.md)

Saved-setup browsing, general Markdown importing, two-way sync, direct Dropbox
OAuth, automatic updates, broker and AI features are not implemented. No source
license has been selected. The owner performs pushes and public release uploads.

[First use, filing rules and OneNote connection](docs/GETTING_STARTED.md).

[Backup, updates and data removal](docs/DATA.md) ·
[Legal documents and outstanding publisher decisions](docs/RELEASE.md#current-evidence-and-documents-to-prepare).
Privacy, terms and provider texts are review drafts; no final legal notice or
project license has been approved.
