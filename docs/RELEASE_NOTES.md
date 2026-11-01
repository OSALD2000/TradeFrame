# TradeFrame 0.6.1 preview

OneNote imports now accept the documented Graph user/group/site resource paths,
retaining their scope and normalizing downloads to `/content`. Unknown links
report only a redacted path shape: account/resource IDs, credentials and query
parameters stay out of errors. The picker asks for connection/notebook selection
before listing, instead of repeatedly invoking an unavailable list operation.

Linux sign-in now initializes and uses the same checked keyring provider for
credential encryption. Previously the async encryptor was combined with the sync
provider check, which could leave the provider unidentified and prevent saving.
Plaintext/fallback storage remains rejected. Normal updates retain the same
profile; session-only sign-in still ends on app exit. After reconnecting, choose
the notebook again. Windows/macOS keep the async credential path.

The owner reported that 0.6.0 still rejected a resource link. The exact live link
shape is not available; documented scope cases and keyring initialization are
reproduced in regression tests. Live import and keyring persistence after restart
still require owner verification. Existing notes and cloud pages stay unchanged.

## Deutsch — 0.6.1

Der OneNote-Import akzeptiert auch die dokumentierten Benutzer-, Gruppen- und
Website-Pfade. Unbekannte Links melden nur ihre Struktur, ohne Konto-/Ressourcen-
IDs, Zugangsdaten oder Parameter. Die Liste prueft zuerst Verbindung und Notizbuch.

Unter Linux wird derselbe gepruefte Schluesselbund initialisiert und zum
Verschluesseln verwendet. Ein normales Update behaelt das Profil; eine nur fuer
die Sitzung gespeicherte Anmeldung endet dagegen beim Schliessen. Nach erneuter
Anmeldung das Notizbuch wieder auswaehlen. Unsichere Ablage bleibt ausgeschlossen.

Der echte Link aus dem gemeldeten Fehler ist noch unbekannt. Import und
gespeicherte Anmeldung nach Neustart muessen mit 0.6.1 noch bestaetigt werden.
Vorhandene Notizen und Cloud-Seiten bleiben erhalten.

## Previous preview — 0.6.0

The owner chose the guided dark workspace with larger controls and subtle motion.
Text and spacing are larger, screen titles are 30px, buttons/inputs have 44px
minimum targets, and the floating capture bar is roomier. Brief hover/press,
panel and dialog feedback explains state changes; only active loading loops.
The system reduced-motion preference disables animations and transitions.
Create setup, Open setup and Connections retain their separate task flow and
preserve the draft when switching pages. Route entry starts at the workspace top.

OneNote opening fixes:

- Accept modern `/content` and older `/$value` image/attachment links; download
  through the documented authenticated Graph `/content` endpoint.
- Return fields and screenshot state together when opening a local/cloud setup,
  then explicitly restore both in the UI. Reject an empty response before showing
  success. Ignore stale initial state replies that could erase loaded images.
- Show safe native diagnostics and an explicit opening status. List readable
  setup names while retaining opaque IDs for selection.

Existing Markdown/PNG journals, schema revisions and credentials are preserved.
The owner confirmed setup upload with 0.5.1; actual 0.6.0 cloud import and rendered
Desktop/narrow-layout acceptance remain open. Automated regressions cover the
resource format and stale reply failures; they are not a live Microsoft test.
Restart TradeFrame fully after installing this version so renderer and native
controls use the same response contract. Single images still need to fit Graph's
request limits (below 3.8 MB); local saves remain available when cloud delivery fails.

For platform packages, publisher configuration and acceptance, see
[release guidance](RELEASE.md), [connections](SYNC.md) and [design](DESIGN.md).

## Deutsch

Die gewaehlt gefuehrte dunkle Oberflaeche hat groessere Schrift, mehr Abstand,
44-Pixel-Bedienelemente und eine groessere Aufnahmeleiste. Kurze Animationen bei
Klicks, Bereichswechseln und Dialogen geben Rueckmeldung; nur beim Laden laeuft
eine Animation dauerhaft. Reduzierte Bewegung deaktiviert die Effekte.
Die drei Bereiche bleiben getrennt; ein Seitenwechsel erhaelt den Entwurf und
zeigt den neuen Bereich von oben.

Der OneNote-Import akzeptiert jetzt aktuelle `/content`-Ressourcenlinks. Bilder
und Formularwerte werden gemeinsam an die Oberflaeche uebergeben; eine spaete
alte Antwort kann die geladenen Bilder nicht mehr loeschen. Leere Antworten
melden keinen Erfolg. Sichere Fehlermeldungen bleiben sichtbar, Setup-Namen
werden ohne technische Uebertragungs-ID angezeigt.

Vorhandene Notizen, Bilder, Formulare und Zugangsdaten bleiben erhalten. Der
Nutzer hat den Upload mit 0.5.1 bestaetigt; echtes Oeffnen mit 0.6.0 und die
visuelle Abnahme sind noch offen. Nach der Installation TradeFrame vollstaendig
neu starten. Fuer einzelne Bilder gilt weiterhin die Graph-Grenze von 3,8 MB.
