# Local setup files

27 October 2026: owner approved the fields and per-setup Markdown/PNG layout.
This is an explicit save of the current selected screenshot, not autosave.

## Save flow

1. Capture and select a screenshot.
2. In Setup details, enter mode (live/backtest), symbol, direction (long/short),
   model, timeframe, optional New York entry date/time, and optional note.
3. Click **Save setup…** and choose a journal folder with the native picker.
4. A new `setup-<UTC timestamp>-<random suffix>` directory contains `setup.md`
   and `chart.png`. Success shows the Markdown path; a second save makes a new
   setup, even if the form is unchanged. No existing files are overwritten.

Symbol/model/timeframe are required free text, limited to 80/120/40 characters;
notes are limited to 20,000. Main-process validation is authoritative. The
renderer cannot choose arbitrary write paths or supply an image for saving:
the folder comes from the native dialog and the image from the native preview.
Saves and captures cannot run concurrently. Source selection must finish first.

Cancellation and reported write errors preserve the draft and preview for retry.
If a write fails, the newly created directory is removed; existing setups are
untouched. A crash or power loss can leave an incomplete new directory. Unsaved
drafts and previews are memory-only and are lost when the app closes.

## Schema version 1

`setup.md` is UTF-8 Markdown with YAML frontmatter. Scalar values are serialized
as JSON literals (also valid YAML) so punctuation/newlines in input cannot add
metadata keys. Fields: `schemaVersion` (1), `createdAt` (UTC ISO timestamp),
`mode`, `symbol`, `direction`, `model`, `timeframe`, `entryTimeNewYork` (local
`YYYY-MM-DDTHH:mm` or null), and `entryTimeZone` (`America/New_York`).
The optional entry time is a wall-clock value: it is not converted to UTC and
daylight-saving ambiguities are not resolved. The body links `chart.png` and
contains the note under `## Notes`. The PNG is the current capture snapshot,
with the resolution limits described in [CAPTURE](CAPTURE.md).

Files survive app restarts and can be opened in a Markdown editor. There is no
saved-setup browser, folder preference, import, edit/overwrite, or sync yet.
The app does not read existing journal files. Schema migrations need a separate
preservation plan before readers or format changes are introduced.

## Verification

Automated checks use synthetic images and temporary directories: field/date
validation, safe metadata serialization, independent repeated saves, unchanged
existing files, cleanup after a simulated disk failure, IPC trust, cancellation,
and capture/save exclusion. Native dialog and visual form acceptance remain open.

Manual: inspect the form at desktop and narrow widths; save a synthetic setup,
open both files in an editor, restart the app and verify the files still exist.
Cancel the folder picker and simulate an unwritable folder; ensure the form and
preview survive and retry works. Do not use real account or employer data.
