# TradeFrame

Den Chart festhalten. Den Trade verstehen. [English](README.md)

Ein lokales Trading-Journal als Desktop-App fuer Linux, Windows und macOS.
Inspiriert vom persoenlichen Eww-/Sway-Journal; TradeFrame funktioniert eigenstaendig.

## Aktuelle Vorschau

- Auto uebernimmt nach Aktivierung neue PNG-Bilder aus der Zwischenablage und wiederholt voruebergehend fehlgeschlagene Leseversuche; Edit image schneidet einzelne Entwurfsbilder zu.
- Bis zu 20 Screenshots mit jeweils verpflichtendem Timeframe, optionalem mehrzeiligem Bildtext und Aufnahmezeit in einer Setup-Markdown-Datei.
- Speichern/Oeffnen, weitere Bilder an dieselbe Datei anhaengen mit Markdown-Sicherung,
  mit vorbereiteter Wiederherstellung nach Prozessabbruch, oder eine eigene Kopie fuer Aenderungen an bisherigen Feldern/Bildern speichern.
- Neues Formular Trading journal mit Marktdatum, New-York-Uhrzeit, Session,
  Instrument, Richtung inklusive No Trade, Modell, Daily Bias, Result und optionalem R.
  Lesbare Notizen und eindeutige Bilder liegen unter Modus/Jahr/Monat/Tag.
- Konfigurierbare Formulare: acht Feldtypen, Schluessel/Tags, Optionen und Abhaengigkeiten.
  SQLite enthaelt nur versionierte Definitionen; Antworten bleiben Markdown, Bilder PNG.
- Gemerkter Journalordner und parallele Obsidian-/Dropbox-Ordnerverbindungen mit
  dauerhafter Auftragsliste, manuellem Wiederholen und Schutz externer Aenderungen.
- OneNote-Anmeldung per Microsoft-Code und Seiten mit mehreren Bildern ueber Graph.
- Paketbau fuer Windows x64, Linux x64 (auch Debian)
  sowie macOS Apple Silicon/Intel mit SHA-256-Pruefsummen. Erst nach vier erfolgreichen
  Builds entsteht ein Release-Entwurf. Windows-/macOS-Artefakte brauchen noch den ersten Workflow-Lauf.

Dies ist eine fruehe Vorschau. Build und Tests bestehen; echte Aufnahme, Layout,
Installerstart, Cloud-Uebertragung und weitere Betriebssysteme brauchen noch Abnahme.
Pakete ab 0.7.2 enthalten die oeffentliche Microsoft-App-ID von TradeFrame:
Connect OneNote waehlen, anmelden und den temporaeren Microsoft-Code eingeben.
Gespeicherte Verbindungen bleiben im App-Profil; App-ID-Einstellungen sind
weiterhin unter den erweiterten Einstellungen erreichbar. Keine
veroeffentlichte, signierte oder notarisierte Version wird behauptet.
[Aktueller Nachweisstand](docs/CONTEXT.md)

## Entwickeln und paketieren

Node.js 24.15+ (24.x) und npm verwenden; unter Linux sind Electron-Systembibliotheken
und eine grafische Sitzung noetig. Tests nur mit kuenstlichem Chart und temporaeren Ordnern.

```sh
npm ci
npm run check
npm start
```

`npm ci` installiert ueber den Postinstall-Schritt des Projekts auch die fest
versionierte Electron-Laufzeit. Bei bewusst deaktivierten Installationsskripten
vor App-Start oder Paketbau ausdruecklich `npm exec -- install-electron` ausfuehren.

`npm run dev` zeigt die Oberflaeche im Browser. `npm run package` prueft alles und
packt die installierte Electron-Runtime in den ignorierten Ordner `release/`.
Auf dem Zielrechner sind Node/npm nicht erforderlich. Fuer das Debian-Paket
braucht der Linux-Build `dpkg-deb`. Windows/macOS werden auf diesen Systemen
gebaut. Das Archiv enthaelt die oeffentlichen Anleitungen mit funktionierenden
relativen Links. [Build, Download und Abnahme](docs/RELEASE.md)

Entwicklungsregeln: [Architektur und verwendete Patterns](docs/ARCHITECTURE.md)
und [Codestil und Formatierung](docs/CODE_STYLE.md).

## Chartbilder mit Auto uebernehmen

**Auto** einschalten, dann in TradingView **Copy chart image** verwenden:
Linux/Windows Ctrl+Shift+S; macOS Cmd+Shift+S, alternativ das Kamera-Menue.
Neue PNG-Bilder aus jeder App kommen bei aktivem Auto in den Entwurf; vorhandene
und unveraenderte Inhalte werden ausgelassen. Pro Bild einen Timeframe ergaenzen
und ausdruecklich speichern. **Edit image** schneidet ein Entwurfsbild zu;
Aenderungen an gespeicherten Bildern brauchen Save copy. Danach Auto ausschalten.
[Verhalten, Grenzen und Pruefnachweise](docs/CAPTURE.md).

## Journal bedienen

Oben rechts in der Kopfleiste steht die installierte App-Version, etwa `v0.7.9`.

Die Seitenleiste trennt **Create setup**, **Open setup** und **Connections**.
Beim Wechsel bleibt dein Entwurf im Speicher. Der Ablauf lautet Aufnehmen →
Beschreiben → Speichern und Senden. Die gefuehrte dunkle Oberflaeche hat
groessere Schrift, 44-Pixel-Bedienelemente und dezente Animationen bei Klicks,
Ladevorgaengen und geoeffneten Bereichen. Reduzierte Bewegung wird beruecksichtigt. Formularwahl und Bearbeitung liegen unter
**Customize the form (optional)**, damit der Einstieg uebersichtlich bleibt.

**Auto** im Journal oder in der schwebenden Aufnahmeleiste einschalten, dann ein
Chartbild aus der Trading-App kopieren. Jedes neue PNG fuegt eine Ansicht hinzu;
der Export bleibt vollstaendig. **Edit image** schneidet ein Entwurfsbild zu,
Escape bricht ab. Fuer ein bearbeitetes gespeichertes Bild Save copy verwenden;
die alten Dateien bleiben erhalten. Pro Bild **Timeframe (required)** waehlen,
zum Beispiel `1m`, `2m` oder `1h`; mehrzeilige Notizen sind optional. Das alte
Trading-setup-Formular behaelt sein zusaetzliches Setup-Timeframe-Feld.
Einzelne Entwurfsbilder lassen sich entfernen; **Start a new setup** leert nach
Rueckfrage den Entwurf. Schliessen der Aufnahmeleiste oder ein neuer/geoeffneter
Entwurf schaltet Auto aus. Die Leiste bleibt bis zum Schliessen im Journal oder
ueber **×** offen.

**Setup details** ausfuellen, mindestens ein **Save destination** ankreuzen und
**Save setup** anklicken. Local journal, Obsidian, Dropbox und OneNote sind einzeln
abwaehlbar; anfangs ist nur Local journal angekreuzt. Speichern/Anhaengen liefert
nur an die angekreuzten Ziele. Nur beim ersten Speichern ins lokale Journal
erscheint dessen Ordnerauswahl; der Ordner wird danach gemerkt. Ohne dieses Ziel
bleibt eine private Arbeitskopie fuer Wiederholungen und weitere Screenshots auf
diesem Geraet, ohne Pflicht zur Journalordner-Auswahl. Den gemeinsamen Elternordner
von `backtesting` und `live` waehlen, beispielsweise `Trading/journaling`.
Trading journal legt nach dem **Marktdatum** ab, etwa:

```text
backtesting/2025/01/07/
  2025-01-07 0930 TEST Short Example.md
  chart-<Notiz-ID>-001.png
```

Aufnahmezeit und Marktdatum bleiben getrennt. Gleiche Notiznamen erhalten `(2)`,
`(3)` usw.; jede Notiz hat eindeutige Bildnamen. Alte/eigene Formulare behalten
ihre separaten `setup.md`-Ordner. Liegt der Journalordner bereits im Obsidian-Vault,
sind die Dateien dort ohne eine zweite Verbindung zu demselben Vault sichtbar. **Open setup → Choose a local setup…** stellt Formular und
Bilder wieder her. Weitere Ansicht aufnehmen und **Append screenshots** nutzen:
Das erweitert dieselbe Datei, erhaelt deren bisherige Bytes und erstellt eine
Markdown-Sicherung. Bestehende Werte/Bilder bleiben dabei unveraendert;
**Save a separate copy** legt fuer solche Aenderungen eine separate Notiz an.
Fehler- und Wiederherstellungstests niemals mit echten Journalen ausfuehren.

Vor dem Schliessen/Neuladen eines gefuellten Entwurfs erscheint eine Rueckfrage.
Bei einem Absturz koennen ungespeicherte Entwuerfe verloren gehen. Vorbereitete
Bildergaenzungen werden beim Oeffnen oder Wiederholen vervollstaendigt; fremde
Aenderungen bleiben Konflikte. Grenzen,
Sicherungen und Anhaenge-Sperren: [Lokale Setup-Dateien](docs/JOURNAL.md).
[Aufnahme und Berechtigungen](docs/CAPTURE.md)

Alte Dateien lassen sich unveraendert oeffnen. Fehlende Bild-Timeframes auswaehlen
und einmal **Save a separate copy** nutzen: Die separate Kopie verwendet Format 5 und kann
anschliessend weitere Bilder aufnehmen. Timeframes werden weder aus Beschriftungen
noch aus Setup-Feldern geraten.

## Verbindungen

Ziele unter **Connections** waehlen. Obsidian und Dropbox koennen gleichzeitig
verbunden sein, optional zusaetzlich OneNote. Explizites Speichern/Anhaengen
uebertraegt nur dieses Setup; kein Journal-Scan und kein Zusammenfuehren beider Richtungen.

Obsidian erhaelt Markdown/PNG im Ordner `TradeFrame/` des ausgewaehlten Vaults.
Dropbox erhaelt dieselben Dateien in einem von der Desktop-App synchronisierten
Ordner. Die Dropbox-App uebernimmt die Cloud-Synchronisierung. TradeFrame meldet
sich nicht an der Dropbox-API an; eine lokale Kopie beweist keinen Cloud-Upload.

OneNote nutzt Microsoft-Zustimmung und erstellt eine Seite mit Feldern, Tags
und allen Bildern im Abschnitt TradeFrame des ausgewaehlten Notizbuchs. Nach
der Anmeldung unter **Connections → OneNote → OneNote notebook** waehlen.
Der Name ist frei. Nach Anlegen/Oeffnen in OneNote **Refresh notebooks** nutzen.
Die Auswahl bleibt nach Neustart erhalten; ein Wechsel beendet offene OneNote-
Auftraege und verschiebt keine vorhandenen Seiten. Neue Uebertragungen brauchen
eine Auswahl. Refresh-Tokens
werden bei geeigneter Systemverschluesselung geschuetzt gespeichert; sonst gilt
die Anmeldung nur fuer diese Sitzung.
Normale Updates behalten das Profil. Bei Sitzungs-Anmeldung den System-
Schluesselbund entsperren und neu verbinden; danach das Notizbuch erneut waehlen.
Unter Linux/Sway waehlt TradeFrame libsecret ausdruecklich; der Schluesselbund
muss laufen und entsperrt sein. Connections erklaert eine fehlende sichere Ablage.
Eine neue Folge-Uebertragung erstellt eine neue OneNote-Seite; vorhandene Seiten
bleiben erhalten. Fehlgeschlagene Auftraege
ueberleben Neustarts und stehen unter **Retry sync**. Trennen beendet offene
Uebertragungen, loescht aber keine vorhandenen Notizen oder Seiten.
Das Speicherergebnis zeigt lokale Speicherung und jedes Ziel getrennt.
**Send saved setup to OneNote** sendet die zuletzt lokal gespeicherte Version,
ohne eine neue lokale Datei anzulegen. Aenderungen vorher speichern.
**Open setup → Browse OneNote setups…** listet TradeFrame-Seiten im gewaehlten Notizbuch. Oeffnen
stellt einen Entwurf wieder her; Speichern legt eine neue lokale Kopie an.
Neue Seiten enthalten einen geprueften Wiederherstellungsanhang. Alte Standard-
formulare werden ausgelesen; unbekannte alte Formulare als Text und Bilder
geoeffnet. Manuelle OneNote-Aenderungen bleiben dort; der Anhang enthaelt die
urspruenglich gesendeten Werte. Jedes Bild muss fuer Graph unter 3,8 MB bleiben;
mehrere Bilder werden in Teilanfragen gesendet. Groessere lokale Setups bleiben.
[Verhalten, Konflikte und Pruefgrenzen](docs/SYNC.md)

Die OneNote-App-ID bleibt auch nach einem Anmeldefehler aenderbar.
**Save application ID** ersetzt sie; **Remove custom ID** entfernt die eigene
ID und lokale Anmeldung. Vorhandene Seiten bleiben erhalten.

## Architektur und Grenzen

Electron verwaltet Aufnahme, Dateien, SQLite, OAuth und Uebertragungsauftraege.
React hat keinen Node-/Dateizugriff; Sandbox und Kontextisolation bleiben aktiv.
Benannte IPC-Befehle pruefen Aufrufer und Eingaben. Bildbytes bleiben in einem
nativen Speichercache hinter undurchsichtigen lokalen Bild-URLs. Fuer SQLite,
Integrationen und Paketierung kamen keine neuen App-Abhaengigkeiten hinzu.

[Roadmap](docs/ROADMAP.md) · [Design](docs/DESIGN.md) ·
[Agenteneinstieg](AGENTS.md) · [Begriffe](GLOSSARY.md)

Nicht umgesetzt: Setup-Browser, allgemeiner Markdown-Import, Zweiwege-Sync,
direkte Dropbox-OAuth-Anmeldung, automatische Updates, Broker- und KI-Funktionen.
Eine Quellcode-Lizenz ist noch nicht gewaehlt. Push und oeffentliche Release-Uploads
fuehrt der Nutzer selbst aus.

[Ersteinrichtung, Ablageregeln und OneNote-Verbindung](docs/GETTING_STARTED.md).

[Backup, Updates und Daten entfernen](docs/DATA.md) ·
[Rechtliche Dokumente und offene Anbieterentscheidungen](docs/RELEASE.md#current-evidence-and-documents-to-prepare).
Datenschutz, Nutzungsbedingungen und Anbieterangaben liegen als Pruefentwuerfe vor;
endgueltige Rechtstexte und Projektlizenz sind noch nicht freigegeben.
