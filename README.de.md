# TradeFrame

Den Chart festhalten. Den Trade verstehen. [English](README.md)

Ein lokales Trading-Journal als Desktop-App fuer Linux, Windows und macOS.
Inspiriert vom persoenlichen Eww-/Sway-Journal; TradeFrame funktioniert eigenstaendig.

## Aktuelle Vorschau

- Schwebende Aufnahmeleiste und native Bildschirm-/Fensterauswahl.
- Bis zu 20 Screenshots mit Beschriftung und Aufnahmezeit in einer Setup-Markdown-Datei.
- Speichern/Oeffnen, weitere Bilder an dieselbe Datei anhaengen mit Markdown-Sicherung,
  oder eine eigene Kopie fuer Aenderungen an bisherigen Feldern/Bildern speichern.
- Konfigurierbare Formulare: acht Feldtypen, Schluessel/Tags, Optionen und Abhaengigkeiten.
  SQLite enthaelt nur versionierte Definitionen; Antworten bleiben Markdown, Bilder PNG.
- Gemerkter Journalordner und parallele Obsidian-/Dropbox-Ordnerverbindungen mit
  dauerhafter Auftragsliste, manuellem Wiederholen und Schutz externer Aenderungen.
- OneNote-Anmeldung per Microsoft-Code und Seiten mit mehreren Bildern ueber Graph.
- Download-Archive mit Runtime, Linux-Debian-Installer und SHA-256-Pruefsummen;
  ein manueller Workflow bereitet Windows-/macOS-/Linux-Artefakte ohne Veroeffentlichung vor.

Dies ist eine fruehe Vorschau. Build und Tests bestehen; echte Aufnahme, Layout,
Installerstart, Cloud-Uebertragung und weitere Betriebssysteme brauchen noch Abnahme.
OneNote benoetigt die registrierte Microsoft-App-ID des Herausgebers. Keine
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

`npm run dev` zeigt die Oberflaeche im Browser. `npm run package` prueft alles und
packt die installierte Electron-Runtime in den ignorierten Ordner `release/`.
Auf dem Zielrechner sind Node/npm nicht erforderlich. Fuer das Debian-Paket
braucht der Linux-Build `dpkg-deb`. Windows/macOS werden auf diesen Systemen
gebaut. [Build, Download und Abnahme](docs/RELEASE.md)

## Journal bedienen

**Capture chart** und dann **Screenshot** in der Leiste anklicken. Bei Bedarf
eine Quelle auswaehlen. Jede Aufnahme fuegt eine Ansicht hinzu; eine Beschriftung
kann deren Timeframe nennen. Einzelne Entwurfsbilder lassen sich entfernen;
**New setup** leert nach Rueckfrage das aktuelle Setup. Die Leiste bleibt bis
zum Schliessen im Journal oder ueber **×** offen.

**Setup details** ausfuellen und **Save setup…** anklicken. Beim ersten Speichern
einen Journalordner waehlen; er wird danach gemerkt. Ein Setup-Ordner enthaelt
`setup.md`, `chart.png`, `chart-002.png` usw. **Open setup…** stellt Formular und
Bilder wieder her. Weitere Ansicht aufnehmen und **Append screenshots** nutzen:
Das erweitert dieselbe Datei, erhaelt deren bisherige Bytes und erstellt eine
Markdown-Sicherung. Bestehende Werte/Bilder bleiben dabei unveraendert;
**Save copy** legt fuer solche Aenderungen einen neuen Setup-Ordner an.
Fehler- und Wiederherstellungstests niemals mit echten Journalen ausfuehren.

Vor dem Schliessen/Neuladen eines gefuellten Entwurfs erscheint eine Rueckfrage.
Bei einem Absturz koennen ungespeicherte Entwuerfe verloren gehen. Grenzen,
Sicherungen und Anhaenge-Sperren: [Lokale Setup-Dateien](docs/JOURNAL.md).
[Aufnahme und Berechtigungen](docs/CAPTURE.md)

## Verbindungen

Ziele unter **Connections** waehlen. Obsidian und Dropbox koennen gleichzeitig
verbunden sein, optional zusaetzlich OneNote. Explizites Speichern/Anhaengen
uebertraegt nur dieses Setup; kein Journal-Scan und kein Zusammenfuehren beider Richtungen.

Obsidian erhaelt Markdown/PNG im Ordner `TradeFrame/` des ausgewaehlten Vaults.
Dropbox erhaelt dieselben Dateien in einem von der Desktop-App synchronisierten
Ordner. Die Dropbox-App uebernimmt die Cloud-Synchronisierung. TradeFrame meldet
sich nicht an der Dropbox-API an; eine lokale Kopie beweist keinen Cloud-Upload.

OneNote nutzt Microsoft-Zustimmung und erstellt eine Seite mit Feldern, Tags
und allen Bildern im Bereich TradeFrame des Standardnotizbuchs. Refresh-Tokens
werden bei geeigneter Systemverschluesselung geschuetzt gespeichert; sonst gilt
die Anmeldung nur fuer diese Sitzung. Eine neue Folge-Uebertragung erstellt eine
neue OneNote-Seite; vorhandene Seiten bleiben erhalten. Fehlgeschlagene Auftraege
ueberleben Neustarts und stehen unter **Retry sync**. Trennen beendet offene
Uebertragungen, loescht aber keine vorhandenen Notizen oder Seiten.
[Verhalten, Konflikte und Pruefgrenzen](docs/SYNC.md)

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
