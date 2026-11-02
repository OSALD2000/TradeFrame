# TradeFrame 0.7.1 preview

Draft replacement confirmations now match the dark app design when starting a
new setup, opening a local/OneNote setup, switching forms or creating a form.
Keep editing has default focus. Escape/cancel preserves current values and
screenshots, and no replacement runs before an explicit positive answer.
The dialog uses the existing modal styling and reduced-motion policy.
Closing or reloading a draft uses the same app-styled warning; the window stays
open until an explicit discard answer authorizes that operation.

No data, authentication or connection format changes are included. File/folder
pickers and startup failures remain native system dialogs.
Real desktop visual/keyboard acceptance is still pending.

# TradeFrame 0.7.0 preview preparation

Local journal, Obsidian and Dropbox now have independent folder/name rules in
Connections. Choose ordered field blocks and preview the result. New Trading
journal notes with configured preferences retain their filing choices in format
6, including for retries and follow-up screenshots. Same-name destination notes
use safe numbered filenames and stable journal identities, including case-only
collisions. Existing notes and custom forms keep their original paths/layouts;
no existing files are moved, renamed or migrated. Format-6 notes need this updated
app; older readers reject them.

The sidebar adds a first-use Setup guide with optional Microsoft app registration,
permission/client-ID instructions, sign-in and notebook selection. Help buttons
open only named official pages through the validated native bridge. Statistics
is an explicit Coming soon placeholder without calculated or fabricated metrics.
The Linux/Windows window menu is hidden by default and can be revealed with Alt;
editing shortcuts and the macOS system menu remain native.

The owner approved the preceding dark-workspace polish. New views reuse its
motion, focus and reduced-motion rules. Automated checks cover legacy formats,
filing preferences/path validation, collisions, follow-ups, redirects/symlinks,
format-6 OneNote round trips, route composition and native helper/menu behavior.
This is preparation for owner review, not a published release. Real window,
Obsidian/Dropbox, OneNote-account and other-platform acceptance still need the
applicable checks in [RELEASE](RELEASE.md). No credentials were migrated and no
account permissions were changed by this work.

[First-use guide](GETTING_STARTED.md) · [Filing behavior](JOURNAL.md) ·
[Decision](adr/0007-snapshot-filing-rules-for-new-setups.md)

# TradeFrame 0.6.3 preview

The owner confirms OneNote imports work with 0.6.2 and sign-in now survives
closing and reopening 0.6.3. Before this fix, the owner's Sway desktop had
libsecret and GNOME Keyring installed, but no saved sign-in file existed.

On Linux/Sway, TradeFrame now selects `gnome-libsecret` before Electron readiness.
Explicit `--password-store` choices and other platforms/desktops are preserved.
The provider must still be available and unlocked; insecure fallback encryption
is rejected. If storage is unavailable, Connections explains that sign-in lasts
only this session and asks to start/unlock the system keyring before reconnecting.
No credential/settings format change is introduced. Restart acceptance comes
from the owner's report; this environment cannot access the desktop Secret
Service. The Electron 45 deprecation warning remains separate.

## Deutsch — 0.6.3

Der Nutzer bestaetigt, dass OneNote-Import und die anderen Verbindungen mit
0.6.2 funktionieren. Mit 0.6.3 bleibt auch die Anmeldung nach Schliessen und
Neustart erhalten, wie der Nutzer bestaetigt.
Unter Sway waehlt TradeFrame jetzt den installierten sicheren Schluesselbund
ausdruecklich vor dem Start. Eigene Startparameter bleiben erhalten.

Der Schluesselbund muss laufen und entsperrt sein. Ist er nicht verfuegbar,
erklaert Connections die Sitzungs-Anmeldung und den naechsten Schritt.
Unsichere Ablage bleibt ausgeschlossen. Einmal mit 0.6.3 verbinden, Notizbuch
waehlen und nach vollstaendigem Schliessen/Neustart pruefen. Der Nutzer hat diesen
Neustarttest bestaetigt; die separate Electron-Warnung bleibt bestehen.

## Previous preview — 0.6.2

The owner's 0.6.1 diagnostic identifies the rejected path as
`/v1.0/users(…)/onenote/resources/…/$value`. Resource downloads now parse OData
owner keys and normalize them to the checked Graph slash-key `/content` endpoint.
Quoted, percent-encoded and unquoted keys are supported; doubled apostrophes
inside quoted keys are decoded. Malformed keys still fail before download.
The regression reproduced the owner's exact error before the fix and checks
original fields/PNGs for all supported owner scopes. Live import still needs
owner confirmation. No authentication, storage format or cloud pages are changed.

## Deutsch — 0.6.2

Die neue Fehlermeldung zeigt den konkreten fehlenden Pfad: `users(…)`.
Der Import wandelt diese OData-Schreibweise in den geprueften Graph-Pfad
`users/…` um. Formularwerte und Originalbilder sind im Regressionstest enthalten;
ungueltige Schluessel bleiben gesperrt. Der Fehler wurde vor der Korrektur exakt
reproduziert. Das Oeffnen des echten Setups muss noch bestaetigt werden.
Die separate Electron-Warnung zur synchronen Schluesselbund-API bleibt bestehen.

## Previous preview — 0.6.1

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
