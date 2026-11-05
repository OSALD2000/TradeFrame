# TradeFrame 0.7.8 clipboard Auto preview

Enable Auto, then use the trading app's Copy chart image command. New PNG images
enter the current draft while Auto stays on, with no automatic save, resizing or
chart detection. The existing clipboard image and unchanged consecutive contents
are ignored. The UI shows Linux/Windows/macOS TradingView hints and a camera-menu
fallback; no foreign-window control or synthetic shortcut is used.

Edit image replaces Select area on the capture bar: choose it on an individual
screenshot to crop that draft image. Notes/timeframe stay intact; Escape preserves
it. Use Save a separate copy after editing an already saved image. Old files,
formats and connections are preserved; no dependency or migration is added.

Auto is off at startup and stops on Stop Auto, bar/window closure or draft
replacement/opening. Late clipboard replies cannot enter a later session. It
accepts images from any app, cannot reliably identify TradingView, and can miss
rapidly replaced clipboard images. Limits and actual verification scope:
[CAPTURE](CAPTURE.md). Native Windows/macOS and real TradingView export acceptance
remain open; this is an unpublished local preview.

# TradeFrame 0.7.7 OneNote cancellation preview

Late HTTP 401 responses from an earlier OneNote session no longer clear a newer
session's in-memory access token. The correction covers page/image downloads,
page creation and follow-up upload batches. Existing cancellation checks after
asynchronous work remain in place; current-session errors still work normally.
It does not revoke consent, delete cloud pages or undo an already accepted write.

Four failing synthetic regressions reproduce the old token loss; two more cover
cancellation while successful upload responses are checked. Formatting,
TypeScript/build and all 208 tests pass on Linux, including all 208 under the
embedded Node runtime. No real account, journal or credential was accessed.
Electron 45.2.2, dependencies, native protections and saved formats are unchanged.
Real cloud/native acceptance, other OS builds and legal/publication gates remain
open; this is a local preview preparation, not a published release.

Initial native Linux follow-up verifies the real Electron renderer/IPC, pixel-exact
cropping, save/append/backup/reopen, temporary folder delivery, draft-close
protection, restart persistence and single-window launch. Desktop and narrow
views are inspected. Capture and file-picker inputs were synthetic; only a test
copy used an existing system sandbox helper. Physical display capture, installed
launch, cloud accounts and other platforms remain open. See the precise
[verification scope](RELEASE.md#native-linux-verification-5-november-2026).

Additional native checks recover exact append contents after actual process kills
at three write boundaries, preserve external edits and reject live writers.
Unavailable-folder retry and external-file conflicts also pass through the UI
across restart, using synthetic local folders without cloud clients. Power-loss
and other-platform behavior remain unverified.

Real screen capture also passes on a private 1x Linux headless output through an
isolated D-Bus/PipeWire/wlr portal. Source/automatic/pointer/keyboard exports match
every expected pixel; Escape, portal denial, window restoration and capture retry
preserve existing data. No capture results are replaced. Physical/scaled displays,
interactive permission/source choice and the owner's earlier marker/quality
report remain open; see [capture verification](CAPTURE.md#native-portal-verification-5-november-2026).

# TradeFrame 0.7.6 runtime maintenance preview

The desktop runtime is pinned to Electron 45.2.2, including Chromium
156.0.8078.80 and Node 24.22.2. The same-major update includes upstream engine
fixes and a Wayland hidden-parent crash fix. No app API, journal/credential
format, capture algorithm or destination behavior is changed by TradeFrame.
Back up before updating; keep the normal app profile and existing Microsoft ID.

Package verification now checks the executable's actual Electron version against
the source pin. A regression proves that a plain Node executable cannot pass as
the packaged Electron runtime. Both the normal Linux checks and all 202 tests
under the updated embedded Node runtime pass with synthetic data; no account or
real journal was accessed. Registry npm audit reports no known vulnerabilities.
Clean source installs now explicitly provision the pinned executable through the
project postinstall; the npm package alone previously left it absent. Existing
scripts-disabled installs can run `npm exec -- install-electron` explicitly.
A clean temporary source install followed by the full check passes all 202 tests.

The runtime's Node-only tests are not native desktop acceptance. Capture,
window/focus behavior, OS permission/keyring and existing credential acceptance,
plus Windows/macOS packages, still require testing on those systems. The Linux
archive needs a correctly installed sandbox helper as before. Nothing was
installed system-wide or published; publisher/license/legal gates remain open.

# TradeFrame 0.7.5 destination selection preview

Every destination now has its own checkbox: Local journal, Obsidian, Dropbox and
OneNote. Any one can be used alone. At least one must be selected; only Local
journal is checked initially. Choices stay for the app session. Connecting a
target does not automatically send setups to it. Save/Append create and retry
only the newly selected delivery jobs; unselected OneNote is not queried.

Local journal off skips its folder picker. A private Markdown/PNG source remains
under app data for retries and follow-up screenshots; copies/backups are retained
without automatic cleanup. Results disclose this working copy without claiming
a journal save or exposing its internal path. Existing local notes are preserved
when appending without that destination. Selecting it again safely resumes/copies
the note, preserving legacy identities, journal IDs, pinned rules and collisions.

Deselection does not disconnect, remove files or cancel previously authorized
jobs. Retry sync and Send saved setup to OneNote remain separate explicit actions.
A journal folder already inside a vault/Dropbox remains visible to those apps.
Authentication, queue/config/document formats, capture and image processing are
unchanged. No dependencies or source folders were added.

5 November follow-up aligns first-use, Connections, footer and cloud-open text
with the optional destinations. Browser rendering at 1120x760 and 640x480 and
synthetic checkbox, navigation, discard/Escape/focus and reduced-motion checks
are verified; native desktop/keyboard workflows and external targets still need
owner acceptance. The unmodified Linux archive still requires a correctly
installed sandbox helper. Previous capture-marker/quality gates remain open.

Development security follow-up: Vite is pinned to 6.4.5 instead of 6.4.2. A
synthetic regression verifies the non-Windows outside-file authorization fix;
the updated lockfile has no known vulnerabilities reported by npm audit on
5 November 2026. Vite is not shipped as a runtime module. Electron 45.0.0 and all
other dependency versions are unchanged; runtime security review remains open.

# TradeFrame 0.7.4 capture repair preview

The owner rejected the first capture implementation: Auto chart cut away content
above a trendline, the area selector appeared in an output, and image quality
was poor. The trendline defect is reproduced against 0.7.3: a 400x300 fixture
with a chart at 25,35 (320x230) produced 25,70 (320x195). Detection now retains
the outer chart extent across interior lines/drawing zones. A narrow-chart
regression also reproduces the former selection of the surrounding side panel.

Capture now requests physical display dimensions and preserves the highest
available native image representation, removing the explicit 2560x1440/1x
request. The journal is hidden while capturing so it cannot cover the chart.
PNG cropping does not resample or use lossy compression. Actual detail still
depends on the OS/portal source and requires a real exported-file check.

Select area uses the full-screen journal temporarily, restoring its preceding
state afterwards. Image and marks share proportional SVG coordinates; pointer
mapping excludes letterbox padding, and marks clear on release before native
export. Only the original cached PNG is cropped; renderer marks are never used
as image input. The reported output marker did not recur on the owner's next
attempt, and no affected PNG was available. Its root cause remains unverified.

No dependency, persisted format or credential change. Native visual/capture/DPI
and Windows/macOS acceptance remain open. This is a repair preview, not a claim
that synthetic checks establish real desktop correctness.

# TradeFrame 0.7.3 preview

The floating bar now offers **Auto chart** and **Select area**. Auto chart uses
local background-color projections to find a large chart region in light or dark
images and adds it directly, without a new preview or confirmation step. It is a
heuristic: ambiguous regions, substantial separated areas and failed detection
keep the original image, with a full-image notice. Identical chart/tool backgrounds,
complex drawings and multi-chart layouts can require Select area.

Select area displays the captured source for drawing a rectangle; releasing the
pointer adds that cutout immediately, including small details. Escape/Cancel and
pointer cancellation preserve previous screenshots. Arrow keys and Enter provide
a keyboard alternative. The native boundary validates the current source and
integer pixel bounds; the selected PNG is used by the existing save/send paths.
The selection works on a still capture inside TradeFrame, not a live desktop overlay.

No OCR service, remote image processing, new dependency, stored crop profile or
file-format change is introduced. Saved/imported images and OneNote session
storage are unchanged. Real desktop selection, crop accuracy, DPI and platform
capture acceptance remain pending; synthetic tests do not establish those results.

# TradeFrame 0.7.2 preview

Packages now include the owner-approved public Microsoft application ID by
default. Users can choose Connect OneNote, sign in with their own account, enter
the temporary Microsoft code and choose a notebook. Registering an app or typing
an application ID is no longer needed for these preview packages. Optional
application settings remain accessible under advanced settings.

Authentication and secure storage are unchanged. Existing custom IDs retain
priority, preserving their encrypted sessions, notebook choices and queued jobs
across an update. There is no automatic disconnect, sign-in or migration. A
deliberate effective-ID change, revoked authorization or unavailable keyring can
still require reconnection. Tests use synthetic profiles and credentials only.

The new configuration copies only the public client ID; no Microsoft account
email, password or user token is copied. This local preview does not claim Microsoft publisher verification,
independent-account acceptance or legal/public-release clearance. The gates in
[RELEASE](RELEASE.md) remain open.

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
