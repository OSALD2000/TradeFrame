# Keep form definitions in SQLite and setup answers in portable files

The owner chose SQLite for form schemas only; setup answers remain Markdown
and PNG. Store immutable, validated schema revisions in the local
database using Node's built-in SQLite support, rather than generate SQL columns
for arbitrary user fields. Dynamic answers stay typed in Markdown frontmatter.

Each exported setup carries its complete schema revision and stable field IDs,
so labels, keys, options and dependencies can change without reinterpreting old
entries or requiring the original database. Keys and literal tags are both
configurable. Hidden answers remain in the draft but are excluded from export.
Existing files are read only after explicit selection and are never silently
overwritten or automatically migrated. Save copy creates a new file; explicitly
appending later screenshots preserves the old bytes as described in
[ADR 0003](0003-deliver-local-setups-to-independent-destinations.md).
For packaged apps the database lives in user data; development imports the earlier
project-local definitions without changing their source. See [JOURNAL](../JOURNAL.md).
