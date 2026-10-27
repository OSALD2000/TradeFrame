# Keep form definitions in SQLite and setup answers in portable files

The owner chose SQLite for form schemas only; setup answers remain Markdown
and PNG. Store immutable, validated schema revisions in the project-local
database using Node's built-in SQLite support, rather than generate SQL columns
for arbitrary user fields. Dynamic answers stay typed in Markdown frontmatter.

Each exported setup carries its complete schema revision and stable field IDs,
so labels, keys, options and dependencies can change without reinterpreting old
entries or requiring the original database. Keys and literal tags are both
configurable. Hidden answers remain in the draft but are excluded from export.
Existing files are read only after explicit selection and are never overwritten
or automatically migrated; re-saving creates a new copy. See [JOURNAL](../JOURNAL.md).
