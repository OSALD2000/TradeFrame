# Local setup files

27 October 2026: the owner approved configurable forms, both Markdown keys and
tags, and conditional fields. SQLite stores **form schemas only**. Setup answers
remain in Markdown and screenshots remain PNG files. See the
[storage decision](adr/0002-versioned-form-schemas.md).

## Save flow

1. Use **Create setup**. To change templates/fields, expand
   **Customize the form (optional)** for the form selector, **New form** and **Edit form**.
   Trading journal is selected for new work. It includes market date, New York
   HH:mm time, session, instrument, direction (including No Trade), model, daily
   bias, result (pending/win/loss/breakeven/notrade) and optional signed R.
   The original Trading setup and custom forms remain unchanged/selectable.
   Journal identity fields must remain present when editing this template.
2. Capture one or more charts and fill in the visible fields below the images.
   Choose a required timeframe for each image, such as `1m`, `2m` or `1h`.
   Each image has optional multiline notes (up to 20,000 characters).
   The original Trading setup form retains its separate setup-level Timeframe.
3. Check at least one **Save destination**, then click **Save setup**. Local journal,
   Obsidian, Dropbox and OneNote are all optional individually; only Local journal
   is checked initially. A journal-folder picker appears only when that destination
   is checked and no journal root is configured. Connections remembers that root.
   With the journal unchecked, an internal working copy remains in the app data
   for retries and later screenshots; only the checked destinations receive files/pages.
4. Trading journal saves to `<root>/backtesting|live/YYYY/MM/DD/` using the market
   date, not the capture day. A note name contains date, optional HHmm New York
   time, instrument, direction and model, for example
   `2025-01-07 0930 TEST Short Example.md`. Names are made safe for all target OSes;
   the original values stay unchanged in metadata. Collisions create `(2)`, `(3)`,
   etc. Images use `chart-<note-UUID>-001.png`, so multiple notes share one day.
   The root is the parent of `backtesting` and `live`; it may itself be in Obsidian.
   Earlier/custom forms still create separate `setup-<UTC timestamp>-<suffix>`
   directories with `setup.md` and the original fixed image names.
   Every save creates a separate note; no existing note or image is overwritten.

The same destination choices apply to **Append screenshots**. Deselecting the
journal before appending leaves that public note unchanged and branches an exact
verified working copy. Selecting the journal again safely extends/copies the
same note there, preserving file identities and pinned filing rules. Internal
copies use owner-only files/directories where supported and are retained without
automatic cleanup. See [delivery choices and retention](SYNC.md#choose-destinations-per-save).

**Open setup → Choose a local setup…** restores an explicitly chosen TradeFrame Markdown file, its
schema snapshot, typed values and all sibling chart PNGs. **Save a separate copy** creates a
new note with a new creation timestamp and leaves the source unchanged.
**Start a new setup** asks before clearing current fields/screenshots. Removing an image
affects the draft only. Closing/reloading a populated draft prompts before discard;
there is no automatic draft recovery after a crash.

**Append screenshots** adds follow-up images to the same current file, including
after reopening it. Existing fields and images must remain unchanged; edits to
those require Save a separate copy. The app checks the original Markdown/image fingerprint,
prepares a Markdown backup as `<file>.<UUID>.bak` and stages complete image files
plus the exact Markdown suffix in an owned `.tradeframe-append-<UUID>/` folder.
A complete recovery record (`.tradeframe-write.lock` for `setup.md`, or
`<note>.tradeframe-write.lock` for named notes) is published only after that data has
been written and flushed. New images are linked exclusively into place; only
then is the Markdown suffix appended. Original text/images are not rewritten.

Opening a selected file or retrying delivery recovers a recognized interrupted
append: it verifies the backup, staged hashes, original images and exact expected
Markdown prefix, then appends only missing bytes. A known live writer is left
alone. The app permits one process per local profile; a second launch focuses
its journal. Concurrent writers across profiles/devices are not supported.
After successful recovery, the operation directory and record are removed and
the Markdown backup remains. Retrying that same recovered append succeeds
without duplicating images. External editor contributions are never truncated.

Unknown/legacy empty lock files, changed images, divergent external text and
altered recovery data stop automatic recovery and preserve the files for
inspection. Do not delete a recovery record or its directory while recovery is
pending. For a legacy empty lock from the earlier preview, close all app instances,
preserve the entire folder, and inspect the Markdown/backup before removing that
legacy lock. There is no reliable intent to replay from an empty record.

Saving and folder delivery publish complete files using hard links. Choose a
local filesystem supporting hard links, such as NTFS, APFS or ext4; unsupported
filesystems report an error and keep the draft. Process termination is tested;
these checks do not establish power-loss durability or a distributed lock.
An interruption before publishing an intent may leave an unreferenced staging
directory, but does not change the existing setup. Unsaved drafts are still
memory-only and are not recovered by this mechanism.

Main-process validation is authoritative. The renderer cannot choose write
paths or submit screenshot bytes: folders/files come from native pickers and
images from the native in-memory image cache. Capture, save, and open operations are mutually
exclusive. Open rejects symlink files, oversized data, and invalid PNG signatures.

Cancellation and reported write errors preserve the draft and preview for retry.
If a write fails, the newly created directory is removed; existing setups are
untouched. A crash or power loss can leave an incomplete new directory. Unsaved
drafts and previews are memory-only and are lost when the app closes.

## Form definitions and SQLite

`form-schemas.sqlite` lives in Electron's user-data directory. Development imports
all revisions from the former ignored `data/form-schemas.sqlite` if present,
without changing that source. Packaged builds never write inside the installation. The only application table is
`schema_revisions(id, revision, schema_json)`. It contains validated schema JSON,
not setup values, screenshots, journal paths or imported note contents.
SQLite database format version is tracked by `PRAGMA user_version` (currently 1).
Unknown database versions and unrelated databases are rejected rather than reset.

Schemas use `formatVersion: 1`, a stable ID, positive revision, name, and ordered
fields. Edits append revisions in a transaction. Old revisions cannot be changed;
stale concurrent edits are rejected. Opening a Markdown snapshot remembers only
its schema; conflicting definitions for the same ID/revision are rejected.

Fields have a stable ID, editable label, unique Markdown key, type, required flag,
and optional tags. Types: text, long text, number, checkbox, single choice,
multiple choice, date, date/time. Choice options separate their stable stored
value from display label and may add their own tags. Labels can be renamed
without changing field identity. Reordering/removing fields affects new revisions;
existing Markdown files keep their original definitions and meaning.

Each field may depend on one scalar parent using equality. Dependencies can be
chained; missing parents and cycles are rejected. A hidden parent's descendants
are also hidden. Hidden field values stay in the current in-memory draft but
are omitted from exports, tags, and required-field checks. No formulas or user
scripts execute. AND/OR expressions and dependent option lists are not implemented.

Keys use letters/digits/underscores and cannot collide with TradeFrame metadata.
Tags may use Unicode letters/numbers, underscores, hyphens and slashes; the editor
accepts comma-separated tags with or without a leading `#`. Empty answers do not
emit tags. Boolean `false` and numeric `0` are explicit answers, so configured
field tags apply to them. Option tags apply only to selected options.

## Markdown format version 5

Each note is UTF-8 with YAML frontmatter. Each value is a single-line JSON
literal (valid YAML), preserving strings, finite numbers, booleans, null, and
ordered string lists. Reserved entries: `schemaVersion: 5`, `createdAt` (UTC ISO),
`tradeframe` (form format version, complete schema snapshot and ordered screenshot
references), and `tags`. Each reference includes its validated local filename, screenshot text
and UTC capture timestamp, plus a required per-image `timeframe`. It accepts
a positive integer (1–9999) followed by `s`, `m`, `h`, `D`, `W` or `M`; `m` is
minutes and `M` is months. The image heading includes this value and capture time; multiline notes come
before the linked PNG. New calendar notes also record a UUID inside `tradeframe`,
`captured` (the first screenshot's UTC date, preserved on copies) and Obsidian `cssclasses` for journal/direction/result. Their schema
uses familiar keys such as `date`, `time_ny`, `type`, `instrument`, `session`,
`result`, `r` and `d_bias`. Tags are derived consistently from the mode and values;
No Trade cannot have an R result. An explicit R of zero remains distinct from empty.
There is no duplicate aggregate timeframe field: each image reference remains
authoritative even when later images are appended.
User-defined keys hold answers; stable field IDs are recovered through the
snapshot's key mapping. Optional missing fields remain distinguishable from
explicit empty strings, empty lists, false, zero, and null in the document API.

The body links each chart PNG with a heading/caption/time, emits literal `#tags`,
and repeats long-text answers
under their field labels for readable notes. During reading, body/tag values
must agree with frontmatter; contradictory or unsupported files fail explicitly.
The reader handles TradeFrame's own exports, not arbitrary YAML/Markdown syntax.
Quoted text, Unicode, whitespace, CRLF, and line breaks round-trip unchanged in
field values. Date/time fields remain wall-clock strings without UTC conversion.
Numbers use JavaScript's finite numeric representation; unsafe integers and -0
are rejected (the input normalizes -0 to 0). Use text for exact large identifiers.

Bounds: 100 fields, 100 options per choice field, 20,000 characters per text
answer, 1 MB UTF-8 per schema, 5 MB per Markdown file, 20 images, 32 MB per PNG and 128 MB total image bytes.
PNG resolution limits remain those of [CAPTURE](CAPTURE.md).

Versions 1–4 remain readable without modifying their files. Missing image
timeframes stay empty; the app does not guess from setup answers or captions.
Choose a timeframe for every legacy image and use Save a separate copy once to produce a
separate version-5 file before appending. Versions 1/2 retain their original
trading fields and New York wall-clock semantics. Appending preserves the original
metadata/body and adds a `tradeframe-screenshot` JSON comment followed by its
exact rendered image section. The reader validates the full chain and file order.
Appending never changes the original creation timestamp or previous field values.
Version-4 appends retain their original short-caption rendering/limit; use Save
copy to use version-5 multiline notes. Old non-TradeFrame Obsidian notes are
reference material, not an import format. No source note is automatically moved.
Unknown versions/keys, duplicate keys, invalid types/options/dates, or hidden
answers in a file are rejected instead of guessed or silently discarded.

Saved-setup browsing, arbitrary Markdown importing and field editing in place
are not implemented. Folder preferences and optional one-way connections are
implemented separately; see [SYNC](SYNC.md). A divergent external body is rejected
rather than interpreted or overwritten.

## Verification

Tests use synthetic images and temporary directories: all field types, conditional
chains/cycles, lossless typed Markdown round trips, old formats, schema history,
SQLite reopen/concurrent edits, unchanged files, simulated disk failure, explicit
file opening, IPC trust and operation exclusion. Separate child processes exit
before image publication, during the Markdown suffix and after committing it;
reopen/retry restores exactly one complete append, including connected folders.
A live writer, external edits, tampered recovery records and invalid paths are
also covered. Server-rendered controls check
typed inputs and editor content. Schema persistence was also checked with the
actual Electron 45 runtime in Node mode, without opening real journals.
Native dialog/visual editor acceptance remains open.

Manual: inspect the form at desktop and narrow widths; save a synthetic setup,
open both files in an editor, restart the app and verify the files still exist.
Cancel the folder picker and simulate an unwritable folder; ensure the form and
preview survive and retry works. Add custom fields, keys/tags and a dependency;
verify hidden values stay in the draft but not in the file. Open the saved file,
then change the form and confirm the old file still restores its old fields.
Do not use real account or employer data.

0.6.0 local/cloud opening returns the complete screenshot state with the form
values. The renderer applies that snapshot rather than relying only on a separate
capture event, and stale initial state replies are ignored after a newer event
or explicit restore. Empty responses cannot report a successful open. This
changes the internal bridge response, not existing Markdown/PNG files. Restart
the app fully after updating the package to keep native and renderer code aligned.

## Configurable filing for new Trading journal notes

Under Connections, each folder destination has its own Folder structure & file
name editor. Select and reorder field blocks, optionally choose a single
subfolder name, and review the synthetic example before Save rules. Empty
optional fields are skipped. Notes use a safe .md name; collisions receive a
number without replacing earlier files. Paths reject traversal, separators in
subfolder names, redirected directories and reserved device names.

After preferences have been configured, new Trading journal notes use format 6.
The note carries validated filing snapshots for the local journal, Obsidian and
Dropbox, never the absolute connection paths. Follow-ups/retries use those saved
choices rather than newer preferences. Destination filename lookup uses the
existing journal identity, so a missing earlier numbered file cannot relocate a
follow-up. Existing targets still undergo complete byte/conflict verification.

Opening a note does not migrate it. Formats 1–5 and their append rendering remain
readable; unconfigured exports and older/custom forms keep their existing layout.
Save copy creates a new identity using current preferences. Format-6 notes require
the updated app and are rejected by older readers. See the
[filing decision](adr/0007-snapshot-filing-rules-for-new-setups.md) and
[first-use guide](GETTING_STARTED.md).
