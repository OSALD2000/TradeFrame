# Organize new trading journals by market date

On 31 October 2026 the owner selected the complete structure of their old
backtesting journal: mode/year/month/day, readable note names, session/result/R
and a text section for each screenshot. The market date controls the folders;
capturing a historical day today must not file it under today's trading date.

Add a separate Trading journal form rather than changing an immutable existing
form revision. Earlier/custom forms remain available. New journal notes use
version 5; versions 1–4 remain readable, with their original append rendering.
Old Obsidian documents are reference data only and are not imported or rewritten.

Several notes may share one day. Images carry a per-note UUID, collisions create
a numbered Markdown filename, and recovery locks belong to individual new notes.
Folder delivery preserves the calendar hierarchy and chosen filename. Keep
existing schema snapshots, native path validation, backups and prepared recovery.

Timeframes remain structured per image, including appended views. The new export
does not maintain a second aggregate timeframe field that could become stale
when preserving the original Markdown during append.
