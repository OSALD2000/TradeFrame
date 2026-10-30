# Keep the journal independent of external services

TradeFrame's first usable release will store Markdown notes and images locally
in a user-selected folder, rather than require a hosted backend or service
account. This preserves the existing quick-journaling workflow and allows
independent use; Obsidian is optional. The approved file format and preservation
behavior are in [JOURNAL](../JOURNAL.md). The later decision to keep only form
definitions in SQLite is recorded in [ADR 0002](0002-versioned-form-schemas.md).

The original decision deferred external connections. On 30 October 2026, the
owner explicitly requested Obsidian, Dropbox and OneNote, including simultaneous
destinations. [ADR 0003](0003-deliver-local-setups-to-independent-destinations.md)
extends this decision while keeping the journal independent of those services.
Runtime connections require explicit folder selection or Microsoft consent;
implementation authorization does not authorize agent access to real journals.
