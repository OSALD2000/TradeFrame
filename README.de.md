# TradeFrame

Capture the chart. Remember the trade.

Eine lokale Trading-Journal-App fuer Windows, macOS und Linux.
Die Idee stammt aus einem eigenen Eww-/Sway-Workflow: Chart aufnehmen,
Setup dokumentieren und weitertraden. [English](README.md)

## Aktueller Stand

Die App hat eine schwebende Aufnahmeleiste, Bildschirm-/Fensterauswahl und eine
Screenshot-Vorschau mit Wiederholen und Verwerfen im Arbeitsspeicher.
**Setup-Eintraege und Speicherung sind noch nicht implementiert.** Native
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
- `npm test`: kompilierten Fensterstart mit einem Electron-Testdouble pruefen;
  vorher `npm run build` ausfuehren. Das ersetzt keinen echten Desktop-Start.
- `npm run check`: Typpruefung, Build und Starttest ausfuehren.

Der aktuelle Installations- und Pruefstatus steht in
[CONTEXT](docs/CONTEXT.md). Die vom Nutzer erzeugte Lockdatei muss noch geprueft
und uebernommen werden; anschliessend ist CI auf `npm ci` umzustellen.
Ein erfolgreicher Build ersetzt keinen echten Desktop-Start.

## Aufbau und weitere Schritte

- `electron/main.ts`: Desktop-Fenster und Lebenszyklus.
- `src/`: React-Oberflaeche und Styles.
- `tests/`: Fensterstart mit Electron-Testdouble.
- `docs/ROADMAP.md`: Umfang, Meilensteine und Abnahmekriterien.
- `.github/workflows/check.yml`: Build-Pruefungen fuer drei Betriebssysteme.

Die Oberflaeche hat keinen Node.js-Zugriff. Context Isolation und Sandbox sind
aktiv; externe Navigation und neue Fenster werden blockiert. Eine schmale
Preload-Schnittstelle stellt Aufnahmebefehle bereit; der Hauptprozess prueft
Aufrufer und Quellenauswahl.

## Aufnahme ausprobieren

**Capture chart** oeffnet die schwebende Leiste. Dort **Screenshot** anklicken,
gegebenenfalls Bildschirm/Fenster auswaehlen und die Vorschau pruefen.
**Retake screenshot** fuehrt zur Leiste zurueck, **Discard** verwirft das Bild.
Die Leiste bleibt nach Aufnahmen offen. **Close capture bar** im Journal oder
**×** in der Leiste schliesst sie.
Noch wird nichts gespeichert; Tastenkombinationen sind nicht erforderlich.

Die [Aufnahmenotizen](docs/CAPTURE.md) enthalten die Sway-Regel zum Schweben,
Berechtigungen, Aufloesungsgrenzen und manuelle Abnahmeschritte.

Die erste nutzbare Version soll Chart-Screenshots und Setup-Notizen als Markdown
mit Bildern in einem waehlbaren Ordner speichern. Obsidian bleibt optional.
Bestehende Journale werden vom Grundgeruest weder eingelesen noch veraendert.

Naechste Arbeiten stehen in der [Roadmap](docs/ROADMAP.md). Installer, Signierung,
Updates, Cloud, Broker-Anbindung und KI folgen hier noch nicht.
Eine Lizenz wurde noch nicht ausgewaehlt.

Die abgestimmte Linear-Designrichtung und Referenzen stehen in den
[Designnotizen](docs/DESIGN.md).

Coding-Agenten beginnen mit [AGENTS.md](AGENTS.md); die Fachbegriffe stehen im
[Glossar](GLOSSARY.md). Dropbox, Obsidian und OneNote sind Ideen fuer spaetere
Integrationen und noch nicht implementiert.
