# TradeFrame 0.5.0 preview

OneNote delivery now percent-encodes filter spaces and respects Graph's documented
4 MB/six-part limits. Multiple images use bounded requests; retry validates an
unfinished page and adds only missing images. Oversized images fail visibly and
leave the local save intact. Safe HTTP status/stage/code diagnostics replace the
single generic sync failure. Save results show each destination separately.

**Send saved setup to OneNote** supports connecting after a local save.
**Open from OneNote…** browses the chosen notebook and restores a separate draft.
New pages include a validated snapshot attachment and original-image hashes;
older standard forms recover values and images, while unknown older forms become
text/image imports. Snapshot import restores originally sent values, not later
handwritten/visible-text edits. Cloud pages and existing local files stay.

The owner also requested a more approachable workspace. Online references and
three directions are recorded in [DESIGN](DESIGN.md); the larger redesign awaits
that choice. Current functional controls reuse the existing approved direction.
Actual account delivery/opening and rendered desktop acceptance remain open.


Choose an existing notebook under **Connections → OneNote → OneNote notebook**
after sign-in. Use **Refresh notebooks** after creating or opening one in OneNote.
Names are unrestricted; pages go into its TradeFrame section, created as needed.
Selection persists across restart. Changing it cancels pending OneNote jobs;
existing pages and local notes stay. New saves need a selected notebook for
OneNote delivery. Missing targets fail without default-notebook fallback.

Connection settings use version 2, preserving a version-1 backup on first change.
Older apps reject the new settings instead of ignoring selected destinations.
Journal files remain unchanged. Microsoft connection was reported successful;
real selected-notebook uploads and visual/native acceptance remain open.

The journal toolbar now shows the app version, including narrow windows. It is
bundled directly from package.json, matching the version of the installer.

OneNote application settings stay available after configuration and failed sign-in.
You can edit the saved public Application (client) ID or remove your custom ID.
Reset disconnects the local session and cancels pending OneNote deliveries while
preserving existing pages and other destinations. Sign-in failures explain the
required app-registration ID and leave reset controls accessible.

New Trading journal form and calendar filing inspired by the owner's previous
journal: market date, optional New York HH:mm time, session, instrument,
direction including No Trade, model, daily bias, result and optional signed R.

Notes use mode/year/month/day folders, for example
`backtesting/2025/01/07/2025-01-07 0930 TEST Short Example.md`.
The market date controls filing even when capturing a historical chart today.
Same-name saves receive a numbered suffix; each note owns unique image names.
Every screenshot retains its required timeframe and now supports multiline text
(up to 20,000 characters), rendered before the image. Follow-ups preserve the
previous Markdown bytes, with independent backups/recovery per named note.

Version-1–4 TradeFrame files and existing/custom form revisions remain readable.
The original Trading setup form remains available. Save copy creates version 5;
old version-4 appends keep their short-caption limit until copied. Existing old
Obsidian journals are reference data and are not moved or imported automatically.
Obsidian/Dropbox folder delivery preserves the calendar hierarchy and filenames.
OneNote includes the multiline text and journal fields/tags.

The combined package workflow targets Windows x64, Linux x64 (Debian and tar),
macOS Apple Silicon and macOS Intel. Check the matching SHA-256 file. Packages
include Electron and need no Node/npm installation on the destination computer.
These are unsigned previews (macOS uses ad-hoc signing). Native desktop/capture
acceptance, trusted signing/notarization and cloud/account tests remain open.
For publisher setup and platform builds, see [release guidance](RELEASE.md).

## Deutsch

OneNote sendet Bilder in begrenzten Teilanfragen gemaess Graph-Limits statt einer
zu grossen Gesamtanfrage. Fehler zeigen HTTP-Status/Schritt/sicheren Code; lokal
wird unabhaengig davon gespeichert. **Send saved setup to OneNote** sendet nach
spaeterem Verbinden die gespeicherte Datei. **Open from OneNote…** oeffnet Seiten
als eigenen Entwurf; bestehende Dateien und Cloud-Seiten bleiben erhalten.
Neue Seiten enthalten Wiederherstellungsdaten mit Bildpruefsummen. Alte bekannte
Formulare werden wiederhergestellt, unbekannte als Text/Bilder importiert.
Der umfassende Designumbau wartet auf die Wahl einer recherchierten Richtung;
echte Konto-Uebertragung/Oeffnen und visuelle Abnahme sind noch offen.

Nach Anmeldung unter **Connections → OneNote → OneNote notebook** ein
vorhandenes Notizbuch waehlen; der Name ist frei. **Refresh notebooks** laedt die
Liste neu. Seiten kommen in dessen Abschnitt TradeFrame. Die Auswahl bleibt
nach Neustart erhalten. Ein Wechsel beendet offene OneNote-Auftraege; vorhandene
Seiten und lokale Notizen bleiben. Verbindungseinstellungen nutzen Format 2 mit
Sicherung des alten Formats; aeltere Apps lehnen die neuen Einstellungen ab.

Die Journal-Kopfleiste zeigt jetzt die App-Version auch im schmalen Fenster.
Die Nummer kommt aus package.json und entspricht der Installationsdatei.

OneNote-App-ID bleibt nach Eingabe oder Anmeldefehler aenderbar und entfernbar.
Entfernen loescht die lokale Anmeldung und offene OneNote-Auftraege, erhaelt
vorhandene Seiten und andere Ziele. Benoetigt wird die Anwendungs-ID (Client-ID)
einer App-Registrierung, nicht eine Profil-/Benutzer-/Mandanten-ID.

Trading journal uebernimmt Datumsordner und lesbare Notiznamen nach dem
Marktdatum. Das Formular enthaelt Session, No Trade, Result/R und Daily Bias.
Jedes Bild hat einen verpflichtenden Timeframe und optionalen mehrzeiligen Text.
Mehrere Setups koennen denselben Tag nutzen; Namenkollisionen erhalten eine
Nummer, Bilder und Wiederherstellung bleiben je Notiz getrennt. Ordnerziele
uebernehmen dieselbe Struktur. Alte TradeFrame-Dateien/Formulare und alte
Obsidian-Ergebnisse bleiben erhalten; es gibt keine automatische Migration.

Die Vorschau ist noch ohne verifizierte Herausgebersignatur. Echte Desktop-,
Windows-/Mac-Installations- und Kontotests sowie Notarisierung bleiben offen.
