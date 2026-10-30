# TradeFrame

Capture the chart. Remember the trade. [Deutsch](README.de.md)

A local-first desktop trading journal targeting Linux, Windows and macOS.
Inspired by a personal Eww/Sway journal; TradeFrame runs independently of it.

## Current preview

- Floating capture bar and native screen/window selection.
- Up to 20 screenshots, captions and capture timestamps in one setup Markdown.
- Save/reopen, append follow-up screenshots to the same file with a Markdown
  backup, or save a separate copy to change earlier fields/images.
- Configurable forms: eight input types, keys/tags, choices and visibility rules.
  SQLite holds only versioned definitions; answers stay in Markdown, images in PNG.
- Remembered journal folder and simultaneous Obsidian/Dropbox folder connections,
  with persisted delivery jobs, explicit retry and protection for external edits.
- OneNote device sign-in and multi-image page delivery through Microsoft Graph.
- Downloadable runtime archives, Linux Debian installer and SHA-256 checksums;
  a manual workflow prepares Windows/macOS/Linux artifacts without publishing.

This is an early preview. Build/tests pass; native capture, layout, installer
launch, real cloud delivery and other operating systems still need acceptance.
OneNote requires the publisher's registered Microsoft application ID. No public
release or signed/notarized build is claimed. [Current evidence](docs/CONTEXT.md)

## Develop and package

Use Node.js 24.15+ (24.x) and npm; Linux needs Electron's system libraries and a
graphical session. Use a synthetic chart and temporary journal folders for tests.

```sh
npm ci
npm run check
npm start
```

`npm run dev` previews the renderer in a browser. `npm run package` runs all checks
and packages the installed Electron runtime into ignored `release/` output. No
Node/npm is needed on the computer running an extracted package. Linux packaging
also requires `dpkg-deb` for the Debian installer. Windows/macOS builds run on
those systems. [Build/download instructions and acceptance](docs/RELEASE.md)

## Journal workflow

Click **Capture chart**, then **Screenshot** on the floating bar. Choose a source
if prompted. Each capture adds a view; captions can identify its timeframe.
Remove individual draft images or use **New setup** to clear the current setup.
The bar stays open until closed from the journal or with **×**.

Enter **Setup details** and **Save setup…**. The first save asks for a journal
folder; later saves remember it. A setup folder holds `setup.md`, `chart.png`,
`chart-002.png`, etc. **Open setup…** restores the complete form and images.
Capture another view and **Append screenshots** to extend that same file while
preserving its original bytes and creating a Markdown backup. Earlier values
and images must stay unchanged; **Save copy** creates a new setup directory for
those edits. Never use a real journal to test failure/recovery behavior.

Closing/reloading a populated draft asks before discarding it. A crash can lose
unsaved drafts; recovery boundaries and append-lock/backup handling are in
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
all images in the default notebook's TradeFrame section. Refresh tokens use
system encryption where supported; otherwise sign-in lasts this session only.
A new follow-up delivery creates a new OneNote page; existing pages are preserved.
Failed deliveries survive restart and appear under **Retry sync**. Disconnecting
cancels outstanding deliveries without deleting existing notes or pages.
[Behavior, conflicts and verification](docs/SYNC.md)

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
