# TradeFrame

Capture the chart. Remember the trade.

Eine lokale Trading-Journal-App fuer Windows, macOS und Linux.
Die Idee stammt aus einem eigenen Eww-/Sway-Workflow: Chart aufnehmen,
Setup dokumentieren und weitertraden. [English](README.md)

## Aktueller Stand

Die App hat eine schwebende Aufnahmeleiste, Bildschirm-/Fensterauswahl und eine
Screenshot-Vorschau mit Wiederholen und Verwerfen im Arbeitsspeicher.
Setup-Details lassen sich als **Markdown plus PNG in einem gewaehlten lokalen
Ordner speichern**. Formulare sind frei konfigurierbar: Feldtypen, Pflichtfelder,
Markdown-Schluessel, Tags, Auswahloptionen und abhaengige Eingaben.
**SQLite speichert nur versionierte Formulardefinitionen; Antworten bleiben in Markdown.**
Exportierte Setups koennen wieder geoeffnet werden; automatische Listen und
Bearbeiten bestehender Dateien fehlen noch. Native
Aufnahme und schwebendes Fenster muessen noch praktisch getestet werden.
Die Zielplattformen sind noch keine praktisch geprueften Desktop-Releases.

## Entwickeln

Node.js 24 LTS ab 24.15.0 und npm verwenden. Unter Linux wird eine grafische
Sitzung mit den von Electron benoetigten Systembibliotheken vorausgesetzt.

```sh
npm install
npm run check
npm start
```

- `npm start`: App bauen und als Desktop-Fenster starten.
- `npm run dev`: Oberflaeche im Browser ansehen; das ist nicht die Desktop-App.
- `npm run typecheck`: TypeScript fuer Oberflaeche und Electron pruefen.
- `npm test`: Aufnahme-/Speicherbefehle mit Electron-Testdouble und lokale Dateien in Temp-Ordnern pruefen;
  vorher `npm run build` ausfuehren. Das ersetzt keinen echten Desktop-Start.
- `npm run check`: Typpruefung, Build und Tests ausfuehren.

Der aktuelle Installations- und Pruefstatus steht in
[CONTEXT](docs/CONTEXT.md). Die vom Nutzer erzeugte Lockdatei muss noch geprueft
und uebernommen werden; anschliessend ist CI auf `npm ci` umzustellen.
Ein erfolgreicher Build ersetzt keinen echten Desktop-Start.

## Aufbau und weitere Schritte

- `electron/main.ts`: Desktop-Fenster und Lebenszyklus.
- `src/`: React-Oberflaeche und Styles.
- `electron/journal.ts`: Eingabepruefung und lokale Markdown-/PNG-Speicherung.
- `electron/form-schema.ts`: typisierte Feldregeln und Markdown-Serialisierung/-Deserialisierung.
- `electron/schema-store.ts`: unveraenderliche Formularrevisionen in lokalem SQLite.
- `tests/`: Electron-Testdouble und Dateispeichertests in Temp-Ordnern.
- `docs/ROADMAP.md`: Umfang, Meilensteine und Abnahmekriterien.
- `.github/workflows/check.yml`: Build-Pruefungen fuer drei Betriebssysteme.

Die Oberflaeche hat keinen Node.js-Zugriff. Context Isolation und Sandbox sind
aktiv; externe Navigation und neue Fenster werden blockiert. Eine schmale
Preload-Schnittstelle stellt Aufnahme-/Formular-/Oeffnen-/Speicherbefehle bereit;
der Hauptprozess prueft Aufrufer, Definitionen, typisierte Antworten, ausgewaehlte
Dateien und Aufnahmequellen.

## Aufnahme ausprobieren

**Capture chart** oeffnet die schwebende Leiste. Dort **Screenshot** anklicken,
gegebenenfalls Bildschirm/Fenster auswaehlen und die Vorschau pruefen.
**Retake screenshot** fuehrt zur Leiste zurueck, **Discard** verwirft das Bild.
Die Leiste bleibt nach Aufnahmen offen. **Close capture bar** im Journal oder
**×** in der Leiste schliesst sie.
Zum Speichern **Setup details** ausfuellen, **Save setup…** anklicken und einen
Ordner waehlen. Jeder Speichervorgang erzeugt einen eigenen Setup-Unterordner.
Abbrechen erhaelt den Entwurf; ungespeicherte Entwuerfe gehen beim App-Schliessen
verloren. Details: [lokale Setup-Dateien](docs/JOURNAL.md).
Tastenkombinationen sind nicht erforderlich.

Die [Aufnahmenotizen](docs/CAPTURE.md) enthalten die Sway-Regel zum Schweben,
Berechtigungen, Aufloesungsgrenzen und manuelle Abnahmeschritte.

## Formulare anpassen

Unter dem Screenshot **Edit form** oder **New form** waehlen. Jedes Feld hat
eine stabile Identitaet, Label, Typ, Markdown-Schluessel, optionale Tags und
eine optionale Sichtbarkeitsregel (anderes Feld gleich Wert). Auswahloptionen
koennen eigene Tags haben. Ausgeblendete Antworten bleiben im Entwurf, landen
aber nicht in gespeicherten Dateien. **Open setup…** oeffnet einen ausgewaehlten
Export samt urspruenglicher Formularrevision und Bild.

Definitionen liegen in der ignorierten `data/form-schemas.sqlite`; Antworten und
Bilder werden dort nicht gespeichert. Markdown enthaelt Schema-Snapshot, typisierte
Antworten und echte Tags. Formatgrenzen, alte Dateien und Erhaltungsregeln stehen
in [JOURNAL](docs/JOURNAL.md). Es ist keine neue Datenbank-Abhaengigkeit erforderlich:
genutzt wird das eingebaute SQLite von Node/Electron.

Als Naechstes folgen Ansicht und Folge-Screenshots gespeicherter Setups.
Obsidian bleibt optional. Bestehende Journale werden nicht automatisch durchsucht oder veraendert.

Naechste Arbeiten stehen in der [Roadmap](docs/ROADMAP.md). Installer, Signierung,
Updates, Cloud, Broker-Anbindung und KI folgen hier noch nicht.
Eine Lizenz wurde noch nicht ausgewaehlt.

Die abgestimmte Linear-Designrichtung und Referenzen stehen in den
[Designnotizen](docs/DESIGN.md).

Coding-Agenten beginnen mit [AGENTS.md](AGENTS.md); die Fachbegriffe stehen im
[Glossar](GLOSSARY.md). Dropbox, Obsidian und OneNote sind Ideen fuer spaetere
Integrationen und noch nicht implementiert.
