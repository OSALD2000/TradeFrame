# Keep the journal independent of external services

TradeFrame's first usable release will store Markdown notes and images locally
in a user-selected folder, rather than require a hosted backend or service
account. This preserves the existing quick-journaling workflow and allows
independent use; Obsidian is optional. The approved file format and preservation
behavior are in [JOURNAL](../JOURNAL.md). The later decision to keep only form
definitions in SQLite is recorded in [ADR 0002](0002-versioned-form-schemas.md).

Dropbox, Obsidian, and OneNote are future integration candidates, not current
dependencies or implemented features. Their mechanisms, permissions, conflict
handling, and supported data remain undecided. Each integration requires a
separate agreed scope; this decision does not authorize connecting accounts or
transmitting journal data.
