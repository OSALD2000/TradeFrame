# Deliver local setups to independently connected destinations

The owner requested Obsidian, Dropbox and OneNote connections together on
30 October 2026. Keep the local Markdown/PNG setup authoritative and deliver
explicit saves/appends to every selected target; use vault/Dropbox desktop
folders for portable files and delegated Microsoft Graph for OneNote pages.
This avoids coupling local saves to cloud availability and preserves externally
edited target files as explicit conflicts rather than silently choosing a winner.
A durable path/status queue supports retries. Two-way edits/merges and direct
Dropbox OAuth are separate work; the app clearly identifies desktop-folder sync.

The personal Super+Ctrl+j flow appends follow-up views to the existing setup.
TradeFrame supports that with unchanged original bytes, a Markdown backup,
fingerprint checks and exclusive image writes. It retains Save copy for changing
existing fields/images. This supersedes the earlier copy-only follow-up boundary.
