# Reopen OneNote setups through validated snapshots

On 1 November 2026 the owner reported missing OneNote deliveries and requested
opening setups from OneNote. Preserve local Markdown/PNG as the editable source;
opening a cloud page creates an in-memory draft and never overwrites a local file
or cloud page. A later save creates a new local note and delivery.

New pages include a small TradeFrame.setup.json attachment with the original
Markdown, schema/values and image hashes. Read original PNG resources from the
page output and validate them against that snapshot. Do not embed full image
copies in JSON. Rebuild authenticated resource requests against Microsoft Graph;
never forward tokens to arbitrary page URLs. Accept modern content and older
$value resource links, normalizing both to the documented Graph /content API. Never render retrieved HTML. Page
IDs must come from the selected notebook's TradeFrame list. Downloads are bounded.

Older pages have no snapshot. Recover known built-in forms from labels/values;
unknown forms become a complete text import with screenshots, instead of guessing
field types or silently discarding text. Missing timeframes require explicit
selection. Recovered standard forms retain the entire legacy text in Notes, so manual
paragraphs survive a local copy and the original calendar semantics remain. Refuse oversized content. A snapshot restores TradeFrame's
saved values; later handwriting or visible-text edits in OneNote are not a
two-way merge and remain on the cloud page.

Graph documents a 4 MB request limit and six multipart parts. Create a page with
its snapshot and up to four images, then append remaining images in bounded
requests of up to five. Retry validates the snapshot and existing original PNGs,
and appends only missing images. A synced page is never updated. Changed
snapshots/images are conflicts. An oversized image fails explicitly without
undoing the local save. Use percent-encoded spaces in OData filters. Expose fixed
stage/HTTP status/error codes, never raw Microsoft or token/network messages.

References: [Graph limits](https://learn.microsoft.com/en-us/graph/onenote-images-files),
[multipart updates](https://learn.microsoft.com/en-us/graph/onenote-update-page),
[output resources](https://learn.microsoft.com/en-us/graph/onenote-input-output-html),
[query encoding](https://learn.microsoft.com/en-us/graph/onenote-get-content).

1 November follow-up: the owner confirmed upload but reported an apparently empty
opened draft. `/content` resources were rejected by the earlier `$value`-only
parser, and a late renderer state response could erase an opened capture. Return
the complete capture snapshot with fields, apply it in the renderer, and ignore
stale initial replies after an event or explicit restore. Retain image hashes,
resource host/path checks and the current draft on failed import. Reference:
[Get resource](https://learn.microsoft.com/en-us/graph/api/resource-get?view=graph-rest-1.0).
