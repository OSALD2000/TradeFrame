# Keep the journal independent of external services

TradeFrame's first usable release will store Markdown notes and images locally
in a user-selected folder, rather than require a hosted backend or service
account. This preserves the existing quick-journaling workflow and allows
independent use; Obsidian is optional. A persistent file schema and migration
behavior still need to be agreed before implementation.

Dropbox, Obsidian, and OneNote are future integration candidates, not current
dependencies or implemented features. Their mechanisms, permissions, conflict
handling, and supported data remain undecided. Each integration requires a
separate agreed scope; this decision does not authorize connecting accounts or
transmitting journal data.
