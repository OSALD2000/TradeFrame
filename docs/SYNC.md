# Connections and delivery

TradeFrame keeps the local journal as the source. Every explicit save creates
a Markdown/PNG setup copy; later screenshots can append to the same file. Connections deliver that state to any
combination of Obsidian, Dropbox and OneNote. External edits are not imported,
overwritten or deleted. Append screenshots preserves existing text/images and extends matching folder
copies with the same suffix. Save copy creates a new independent note.

## Folder connections

In **Connections**, choose a local journal folder, an Obsidian vault, and/or a
folder managed by the Dropbox desktop app. These are independent destinations;
Obsidian and Dropbox can be active together. Target folders are selected using
the native picker. No filesystem scanning or account discovery takes place.

Obsidian is a [folder of local notes](https://help.obsidian.md/Files+and+folders/Manage+vaults).
Trading journal delivers to `<vault>/TradeFrame/backtesting|live/YYYY/MM/DD/`
with the same named Markdown and UUID image files as the source. Multiple notes
can share a day; their locks, images and backups remain independent. Earlier/custom
forms still use `<vault>/TradeFrame/<setup-folder>/`. All image links are relative. Obsidian needs no plugin. Dropbox receives the same structure under
`<selected-folder>/TradeFrame/`. The [Dropbox desktop app](https://help.dropbox.com/sync/sync-overview)
handles cloud synchronization; TradeFrame does not authenticate to Dropbox or
claim that writing the local Dropbox folder proves cloud delivery. The desktop
client must be installed, signed in and syncing the selected folder.

If the local journal folder is already in the vault, its files are directly
visible to Obsidian; connecting the same vault as another destination would
create an additional copy under TradeFrame. Choose the parent of backtesting/live
as the local journal root.

The app remembers the local journal folder. The first save asks for it if unset.
Changing/resetting it does not move old files. Connecting a destination affects
future saves. A disconnected target's pending deliveries are canceled; it does
not remove any previously delivered files. No transfer is made during setup.

## OneNote

Use **Connect OneNote**, enter the displayed code at Microsoft's sign-in page,
and approve the delegated permission. Then choose an existing notebook under
**Connections → OneNote → OneNote notebook**. Names are unrestricted; select
from the list rather than typing a name. If empty, create or open a notebook in
OneNote with the same account, then use **Refresh notebooks**. The app checks the authorization status
at Microsoft's interval, stops on expiration/denial, and handles throttling.
No account password, access token, refresh token or private device code is sent
to the renderer. **Disconnect** cancels pending OneNote deliveries and removes
the local credentials; it does not delete cloud pages or revoke consent at Microsoft.

The Microsoft application settings remain available after configuration and after
failed sign-in. **Save application ID** replaces a custom ID; **Remove custom ID**
removes it and disconnects the local OneNote session, including encrypted saved
credentials and pending OneNote deliveries. Existing notes/pages and other folder
jobs remain unchanged. If the build embeds a publisher ID, removing an override
restores that default; otherwise OneNote becomes unconfigured. Changes survive
restart. Only the public application ID is exposed to the UI, never tokens.

Use **Application (client) ID** from **Entra ID → App registrations → TradeFrame →
Overview**. A user/object ID or directory/tenant ID is a different identifier.
A configured publisher application ID is required; [release setup](RELEASE.md)
describes registration. A personal Microsoft account needs an initialized
OneNote notebook for the personal-account flow. Organization policy
can restrict access. Only Microsoft's global cloud endpoints are implemented.

The selected notebook ID/name persist across restart with the app identity.
Disconnect, app-ID changes and a new sign-in clear the selection; select again
after connecting. Changing notebooks cancels pending/failed OneNote jobs, while
local files, other destinations and existing cloud pages stay. A new sign-in
also cancels pending OneNote jobs before starting authentication. Each new job
keeps its chosen notebook ID even across retries. If it becomes unavailable,
delivery fails without falling back to another notebook.

Each save/append delivery becomes a new page in the selected notebook's
`TradeFrame` section, created during delivery if missing. New saves without a
selection succeed locally with a warning; select a notebook and use
**Send saved setup to OneNote** to send that saved version. Fields, tags and all screenshots are included as escaped HTML and PNG
parts following the [OneNote multipart API](https://learn.microsoft.com/en-us/graph/onenote-create-page).
The page title includes a unique delivery UUID. Retrying first searches for that
title and reuses the page if it already exists, including after a lost response.
Renaming/deleting that page externally removes this duplicate-detection marker;
retrying then may create another page. Synced pages are never edited by the app.
An unfinished delivery may append its missing images after verifying the snapshot
and already uploaded PNGs; changed content fails instead of being replaced.

Graph documents a 4 MB request limit and six multipart parts. TradeFrame keeps
requests below 3.9 MB, creates a page with its snapshot and up to four images,
then appends batches of up to five. Individual images/details must be below
3.8 MB. Larger captures fail with an actionable message; local saves still
support 128 MB total. A failed upload never undoes the local save. HTTP status,
a safe service error code and the failing stage appear under Retry sync; raw
Microsoft/network messages and tokens are never displayed.

A successful local save is shown separately from each destination's result.
Connecting after saving does not upload automatically. **Send saved setup to
OneNote** sends only the unchanged, last saved file to the chosen notebook;
unsaved edits need saving first. It adds no extra Obsidian/Dropbox deliveries.

Refresh tokens are encrypted through Electron 45's asynchronous `safeStorage`
and written with user-only file permissions. On Linux, persistence requires a
recognized system secret backend; unavailable/insecure backends keep credentials
in memory for this session only. Windows/macOS use their OS credential encryption.
Access tokens remain in memory. Failed decryption asks for reconnection.
No tokens are stored in the form-definition SQLite database.

## Open from OneNote

**Open from OneNote…** lists TradeFrame pages from the selected notebook's
TradeFrame section. Listing does not create a section. Choose a page to restore
an in-memory draft, then save a new local copy. Existing local files and the
cloud page stay unchanged; the draft cannot append to an unchosen local file.

New pages attach TradeFrame.setup.json with the validated original Markdown and
PNG hashes. Original image resources are downloaded within bounded limits and
checked before replacing the draft. Retrieved HTML is never rendered. Resource
links are validated and rebuilt on Graph; tokens never go to a page-supplied host.
Old pages without a snapshot recover standard-form values and screenshots,
keeping the complete original page text in Notes, including manual additions.
Unknown older forms open as full page text plus screenshots rather than guessed
field types. Missing timeframes must be chosen. Oversized or inconsistent
content is rejected without truncation or changing the current draft.

Snapshot import restores what TradeFrame originally sent. Later handwritten or
visible-text edits in OneNote remain on the page and are not merged into that
snapshot. This is cloud opening and separate-copy saving, not two-way editing.
See [snapshot/retry decision](adr/0006-reopen-cloud-setups-with-validated-snapshots.md).

## Queue, retries and conflicts

`connections.json` in Electron's user-data directory stores chosen folders and
delivery jobs, including source paths, chosen notebook IDs and fixed error/status messages. It contains
no note text, images or OAuth tokens. Jobs are persisted before delivery. Failed
or pending jobs survive restart; use **Retry sync** in Connections. The source
snapshot must still exist. New saves do not repeatedly retry older jobs.

Connection settings are version 2. A version-1 file stays untouched on read;
its original bytes are backed up once as `connections.json.v1.bak` on first
mutation. Older app versions reject version 2, preventing them from ignoring
notebook IDs. Existing jobs without an ID retain their legacy default-notebook
destination unless canceled. Journal files and credential formats are unchanged.
See [destination decision](adr/0005-pin-onenote-deliveries-to-selected-notebooks.md).

Folder retries compare every existing target file with the source. Identical
files are reused, missing files are copied exclusively, and any different or
symbolic-link target fails without overwriting it. An existing Markdown file may
be extended only when its complete bytes match a valid earlier prefix of the
source and the suffix contains validated follow-up screenshot blocks. A missing selected root is
not recreated, so an offline/unmounted drive is not silently replaced by a
directory on another filesystem. Markdown is written after the images as the
snapshot completion marker. An abrupt process/OS crash can leave an incomplete
folder. Retrying completes only a recognized prepared append whose stored
backup/hashes and exact Markdown prefix still match. It waits for a live writer
and stops without truncating foreign text or replacing changed images. New files
are published complete. See [append recovery](JOURNAL.md) for hard-link filesystem
requirements and the handling of old empty locks or unrecognized recovery data.
No background watcher
or two-way merge is implemented.

The queue keeps pending/failed jobs and the last 50 completed jobs, up to 1000
total. If the queue cannot be persisted, the save result explicitly reports that
the local copy succeeded but sync could not finish. Local files remain available.

## Verification boundary

Temporary-folder tests cover parallel destinations, restart/retry, missing roots,
conflicts, symlink rejection and old-file preservation. Mocked Microsoft responses
cover code polling, encrypted-token calls, refresh, escaped multipart content and
duplicate detection after a lost response, paginated notebook discovery, target
selection/restart, unavailable notebooks, version-1 connection backups, Graph
request limits, interrupted multipart delivery and old/new cloud setup opening. The
owner reported successful Microsoft connection on 1 November; a real page upload
to a chosen notebook is still unverified. Automated tests do not prove a cloud
upload, real Dropbox delivery or native folder dialogs.
Those acceptance checks remain open until run with explicitly chosen accounts
and synthetic setups on the target desktops.
