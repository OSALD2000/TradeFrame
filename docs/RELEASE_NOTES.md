# TradeFrame 0.2.0 preview

Each screenshot now has its own required timeframe, such as `1m`, `2m` or `1h`.
The value is preserved in Markdown metadata, image headings, folder delivery and
OneNote pages. Captions remain optional. Earlier files open unchanged: choose
their missing image timeframes and use **Save copy** once before appending.

This combined preview targets Windows x64, Linux x64 (`.deb` and `.tar.gz`),
macOS Apple Silicon and macOS Intel (`.zip`). Check the matching SHA-256 file.
Packages contain the Electron runtime; Node/npm is not needed to run them.
For Debian/Ubuntu, installing the `.deb` supplies the sandbox helper permissions.

These are unsigned preview downloads (macOS uses ad-hoc signing). Trusted
publisher signing/notarization and native acceptance on every platform remain
open. The automated packaged-runtime check does not verify desktop capture or
layout. Cloud and OneNote account acceptance is deferred; OneNote also needs the
publisher's registered Microsoft application ID. See [release guidance](RELEASE.md).

## Deutsch

Jeder Screenshot hat jetzt einen eigenen verpflichtenden Timeframe, etwa `1m`,
`2m` oder `1h`. Er bleibt in Markdown, Bildüberschriften, Ordnerzielen und
OneNote erhalten. Alte Dateien bleiben unveraendert: fehlende Bild-Timeframes
auswaehlen und einmal **Save copy** verwenden, danach an die Kopie anhaengen.

Gemeinsame Vorschau fuer Windows x64, Linux x64 und macOS Apple Silicon/Intel.
Pruefsummen liegen bei; die Electron-Runtime ist enthalten. Unter Debian/Ubuntu
das `.deb` installieren, damit die Sandbox-Dateirechte korrekt gesetzt werden.
Herausgebersignatur, Notarisierung und native Abnahme aller Plattformen sind noch
offen. Cloud-/OneNote-Kontotests folgen spaeter; OneNote braucht die registrierte
Microsoft-App-ID des Herausgebers.
