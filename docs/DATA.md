# Back up, update and remove TradeFrame data

These instructions describe preview **0.7.10**. Use a synthetic setup to rehearse
restoration. They do not establish native acceptance on another operating system.
For installation and checksum verification, see [RELEASE](RELEASE.md).

## Where data lives

Auto's clipboard-monitoring choice and unsaved imported/cropped images are
session-only. Auto starts off and stops on draft replacement or app exit. Auto
does not change or clear the OS clipboard; a separately installed clipboard
manager can retain its own copies. Edit image changes the in-memory draft only;
use Save copy after editing an already saved image to preserve its old files.

The installation directory contains the app, not its journal or profile.
TradeFrame uses Electron's `app.getPath('userData')` for its profile. Typical
locations are shown below; OS configuration and launch options can change them.
Confirm the directory before copying, replacing or removing anything. These paths
have not been verified by launching a native app on every target OS.

| System  | Typical profile directory                                           |
| ------- | ------------------------------------------------------------------- |
| Linux   | `$XDG_CONFIG_HOME/TradeFrame`, or `~/.config/TradeFrame` when unset |
| Windows | `%APPDATA%\TradeFrame`                                              |
| macOS   | `~/Library/Application Support/TradeFrame`                          |

The location follows [Electron's user-data path rules](https://www.electronjs.org/docs/latest/api/app#appgetpathname).
The application-owned files are:

| Profile item                                  | Content                                                                                               |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `form-schemas.sqlite` and any SQLite sidecars | Versioned form definitions; field labels and options can contain personal text                        |
| `connections.json`                            | Chosen absolute folder paths, delivery sources/destinations, notebook IDs, job status and safe errors |
| `connections.json.v1.bak`, if present         | Earlier connection metadata retained on upgrade                                                       |
| `filing-rules.json`                           | Folder and note-name preferences, including custom text                                               |
| `onenote.json`, if present                    | Custom public Microsoft application ID, not a client secret                                           |
| `onenote-notebook.json`, if present           | Selected notebook ID/name and application ID                                                          |
| `onenote-token.bin`, if present               | OS-encrypted refresh token; treat as a credential                                                     |
| `saved-setups/`, if present                   | Markdown/PNG working copies and append backups retained when saving without a public local journal    |

Electron can also create browser caches and runtime files inside the profile.
Keep profile backups private. OS encryption protects the saved token, not the
journal text, PNGs or the entire profile. A copied token may not decrypt on another
device or OS account; reconnect rather than weakening credential protection.

Selected journal, Obsidian and Dropbox folders are outside this inventory and
can themselves be synced or shared. Keep each note with all linked images.
Calendar folders may contain several notes sharing the same day; do not delete
the whole day to remove one setup. [File layout and recovery](JOURNAL.md)

## Back up and restore

1. Finish or cancel active saves/transfers. Save any draft you want to keep;
   unsaved drafts are memory-only. Close TradeFrame, including its capture bar,
   and ensure no instance is still running.
2. Copy the complete profile and each selected journal/destination folder to a
   private backup location. Include hidden append recovery directories, lock
   records, Markdown backups and any SQLite sidecars. Do not copy just the main
   SQLite file while the app is running.
3. Back up cloud content using the service's own facilities as well. A local
   Dropbox write is not proof that the client uploaded it. A OneNote snapshot
   restores originally sent content; it does not merge later OneNote edits.
4. Verify a copied synthetic Markdown note opens with all its fields/images in
   TradeFrame. Preserve the untouched backup before attempting a real restore.

For restoration, close TradeFrame and preserve the current profile/folders first.
Restore into the intended locations without merging over unrelated live files.
Use the same or a compatible newer app version. Review Connections and pending
jobs before **Retry sync**: restored jobs and original absolute paths can refer
to old locations or already delivered cloud content. A complete profile restore
across devices/OSes is not an automated migration feature. If paths or encrypted
credentials no longer work, reconnect the intended folders/account explicitly.

Keep append recovery data together until the note has reopened successfully.
External edits stop recovery rather than being overwritten; see
[recovery limits](JOURNAL.md#save-flow). A backup is not verified merely because
the copy operation succeeded.

## Update without resetting the profile

Back up first, close the app, verify the new download's checksum, and extract the
whole archive into a separate installation folder (or use the appropriate package
manager for the Debian build). Launch the replacement from there. Do not extract
over a running app or copy the profile into the installation directory.

Normal updates reuse the existing profile; do not remove it, change the Microsoft
application ID or disconnect as an update step. After updating, check the version,
connections and a synthetic save/reopen. There is no automatic updater. Notes
using format 6 need TradeFrame 0.7.0 or later; do not assume an older app can read
new files or profile changes. Keep backups before attempting a downgrade.

## Stop delivery and remove data

Unchecking a save destination affects that save/append only. It does not cancel
older pending jobs. Disconnect the relevant destination in **Connections** to
cancel its outstanding jobs. Disconnecting OneNote also removes the local saved
token/notebook selection; it preserves a custom public app ID and delivered pages.
It does not revoke Microsoft's authorization grant. Use the account's Microsoft
application-permission controls (or the organization's administrator) for that
separate action. [Connection behavior](SYNC.md)

To remove TradeFrame completely:

1. Export/back up anything to retain, disconnect destinations, then close all
   instances. Do not remove a working copy while a delivery or append still
   needs it.
2. Remove the extracted app folder and manually installed launcher, or uninstall
   the Debian package with the system package manager. This does not erase the
   profile or external notes.
3. After confirming its identity and backup, remove the TradeFrame profile if
   you want to erase local settings, saved credentials, jobs and working copies.
   This also removes custom form definitions. There is no in-app profile-erasure
   or working-copy cleanup command.
4. Remove unwanted Markdown, linked PNGs and backups separately from each journal,
   vault or Dropbox folder. Coordinate synced deletions with that service's
   client; review its trash, history, shared copies and retention controls.
5. Delete unwanted OneNote pages using OneNote and review its recycle bin and
   account retention controls. Revoke the app grant separately if desired.
   Review your own backup copies and any support attachments too.

Removing local files is not guaranteed secure erasure of SSDs, system backups,
cloud history or copies held by other people. No retention deadline or automatic
cleanup of saved setups/backups is implemented.
