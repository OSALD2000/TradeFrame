# Local setup files

27 October 2026: the owner approved configurable forms, both Markdown keys and
tags, and conditional fields. SQLite stores **form schemas only**. Setup answers
remain in Markdown and screenshots remain PNG files. See the
[storage decision](adr/0002-versioned-form-schemas.md).

## Save flow

1. Select a form under Setup details, or use **New form** / **Edit form**.
   The included Trading setup form contains the original trading fields.
2. Capture one or more charts and fill in the visible fields below the images.
   Each capture adds another view; captions can identify its timeframe or purpose.
3. Click **Save setup…** and choose a journal folder with the native picker
   if none is configured. Connections remembers the folder for subsequent saves.
4. A new `setup-<UTC timestamp>-<random suffix>` directory contains `setup.md`
   and `chart.png`, `chart-002.png`, etc. Success shows the Markdown path; a second save makes a new
   setup, even if the form is unchanged. No existing files are overwritten.

**Open setup…** restores an explicitly chosen TradeFrame Markdown file, its
schema snapshot, typed values and all sibling chart PNGs. **Save copy** creates a
new directory with a new creation timestamp and leaves the source unchanged.
**New setup** asks before clearing current fields/screenshots. Removing an image
affects the draft only. Closing/reloading a populated draft prompts before discard;
there is no automatic draft recovery after a crash.

**Append screenshots** adds follow-up images to the same current file, including
after reopening it. Existing fields and images must remain unchanged; edits to
those require Save copy. The app checks the original Markdown/image fingerprint,
prepares a Markdown backup as `<file>.<UUID>.bak` and stages complete image files
plus the exact Markdown suffix in an owned `.tradeframe-append-<UUID>/` folder.
A complete `.tradeframe-write.lock` record is published only after that data has
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

## Markdown format version 3

`setup.md` is UTF-8 with YAML frontmatter. Each value is a single-line JSON
literal (valid YAML), preserving strings, finite numbers, booleans, null, and
ordered string lists. Reserved entries: `schemaVersion: 3`, `createdAt` (UTC ISO),
`tradeframe` (form format version, complete schema snapshot and ordered screenshot
references), and `tags`. Each reference includes its fixed local filename, caption
and UTC capture timestamp.
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

The original version-1 and version-2 TradeFrame exports can be opened with their fixed trading
schema and New York wall-clock semantics. Original files are never migrated or
rewritten automatically. Save copy produces a separate version-3 copy. Appending preserves the original
metadata/body and adds a `tradeframe-screenshot` JSON comment followed by its
exact rendered image section. The reader validates the full chain and file order.
Appending never changes the original creation timestamp or previous field values.
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
