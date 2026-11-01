# Pin OneNote deliveries to a selected notebook

The owner asked where to choose the desired notebook on 1 November 2026.
Replace implicit default-notebook delivery for new saves with a selection of
existing notebooks after sign-in. Persist its opaque ID and display name, not
only its name. A named TradeFrame section is created as needed in that notebook.
The existing delegated Notes.ReadWrite permission supports these operations.

Persist the selected notebook with the application identity; keep it across a
normal restart, and clear it on disconnect, app-ID changes or a new sign-in.
Every new OneNote job snapshots the notebook ID. Switching targets cancels
pending OneNote jobs rather than silently sending them elsewhere; local files,
other destinations and existing cloud pages remain unchanged.

Connection settings use version 2, with a preserved version-1 backup on first
write. This prevents older app versions from ignoring notebook IDs and routing
new pending jobs to their implicit default notebook. Existing jobs without a
notebook ID retain their old destination until canceled or completed.

Graph pagination is followed only for the same collection on graph.microsoft.com;
tokens never go to an arbitrary URL. A missing/unavailable selected notebook or
section is an error, not permission to fall back to another notebook.
