# Retain destination filing choices with each new setup

The owner selected independent filing rules for the local journal, Obsidian and
Dropbox, edited through ordered field blocks and a preview. On 1 November 2026
the owner approved storing those choices with newly saved Trading journal notes.
When preferences have been configured, new notes use format 6 and retain all
three validated rules. Preferences live separately in the application profile;
absolute connection paths are never included in the note's filing snapshot.

Using the current preferences during retry would redirect older deliveries after
a settings change. A profile-only lookup table would lose that association when
a note moves to another installation. Instead, each note carries its filing
snapshot and existing journal identity. Filename collision lookup recognizes that
identity before choosing a free numbered name, including when an earlier number
has disappeared. Content verification still rejects externally edited targets.

Existing notes are not migrated, moved or renamed. Formats 1–5 retain their
previous reading/append behavior, and unconfigured exports still use format 5.
New format-6 notes require the updated app; older readers reject them. Earlier
custom forms retain their original layout. OneNote notebook/section organization
and authorization are unchanged. No new factory hierarchy or plugin registry is
introduced: pure filing rules, a small preferences store, versioned snapshots and
the existing connector factory remain the implementation boundaries.
