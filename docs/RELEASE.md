# Download packages and verification

TradeFrame is an early desktop preview. Linux packaging can be built locally;
Windows and macOS packages must be built and tested on their respective systems.
These packages are unsigned. No public release has been made by the agent.
For the current licensing, legal-document and publisher readiness research,
see [Release documentation and legal readiness](#release-documentation-and-legal-readiness).

## Build

Use Node 24.15+ (24.x) and the committed lockfile:

```sh
npm ci
npm run package
```

The project postinstall hook explicitly invokes the installed, pinned
`install-electron` command. The Electron npm package alone does not provision its
runtime executable in the clean installation tested here. Initial provisioning
needs the official runtime download or its verified cache. If using
`npm ci --ignore-scripts`, run `npm exec -- install-electron` explicitly before
starting/packaging. No global npm script policy or OS security setting is changed.

This runs the build and tests, bundles the installed, pinned Electron runtime,
writes a native package and SHA-256 checksum in `release/`, then executes that
package's embedded Node runtime to check its platform/architecture, compiled code
and in-memory SQLite. This does not open the desktop UI or access user data.

- Linux: `TradeFrame-<version>-linux-<arch>.tar.gz`.
- Debian/Ubuntu x64/arm64: `TradeFrame-<version>-<debian-arch>.deb` (requires `dpkg-deb` at build time).
- Windows: `TradeFrame-<version>-win32-<arch>.zip`.
- macOS: `TradeFrame-<version>-darwin-<arch>.zip`, including `TradeFrame.app`.

Move any previous package of the same version/architecture before rebuilding.
Build output is ignored by Git. The script includes only compiled app code,
public metadata, selected public guides/ADRs and runtime licenses. It does not include development data,
journals, settings, credentials, `.todo`, source control or `node_modules`.
React is already bundled by Vite; Electron is copied from the installed runtime.
This follows Electron's documented [manual packaging](https://www.electronjs.org/docs/latest/tutorial/application-distribution).

The **Download packages** GitHub Actions workflow can run manually for artifacts
only, or when the owner pushes a version tag such as `v0.7.7`. The tag must match
`package.json`. Four native jobs build Windows x64, Linux x64, macOS Apple Silicon
arm64 and macOS Intel x64. Every job runs the tests and packaged-runtime check.
The macOS bundle and helper identifiers are branded before ad-hoc signing; package
validation uses the renamed `TradeFrame.app` resource path.

On a version tag, a final job waits for every platform job and requires all five
archives/installers and their matching checksums. It verifies SHA-256 values before
creating one **draft** GitHub Release with every download. A rerun may replace
assets only on an existing draft; it refuses to alter a published release. No job
publishes the draft. A manual run never creates a release. The owner reviews the
draft, tests each claimed platform and publishes it. A successful workflow proves
packaging and the embedded runtime check, not desktop/capture acceptance.

After reviewing the local result, the owner can push the prepared commit and tag:

```sh
git push origin main
git tag v0.7.7
git push origin v0.7.7
```

Review **Actions → Download packages**, then the combined draft under **Releases**.
Keep the release in draft if any platform fails. See [preview notes](RELEASE_NOTES.md).

## Run a downloaded package

Verify the checksum before extracting. Keep the extracted folder together.
Windows users start `TradeFrame.exe`; Linux users start `./tradeframe`; macOS
users open `TradeFrame.app`. Node/npm is not required on the destination computer.

Debian/Ubuntu users can install the `.deb` with their package manager. It includes
a desktop launcher and the sandbox helper with root ownership and mode 4755 in
the package metadata. Building/extracting a `.deb` is not an installed-app test.

Linux requires the normal Electron system libraries and a functioning Chromium
sandbox. Some distributions restrict user namespaces or require the bundled
`chrome-sandbox` helper to be installed with root ownership and mode 4755 by an
administrator. The app never disables sandboxing. The supplied `.desktop` entry
needs an absolute `Exec` and `Icon` path before installing it on a desktop.

Windows reputation prompts and macOS Gatekeeper/notarization remain release
work. The macOS bundle is re-signed ad hoc after branding; this does not establish
a trusted publisher identity. Do not claim a signed/notarized public release.

## OneNote publisher setup

Version 0.7.2 packages default to the public `config.microsoftClientId` in
`package.json`, approved by the owner from the existing working TradeFrame
registration. This configuration copies only that public identifier, not the
Microsoft account owner's email, password, tokens or notebook data. Existing
Debian Maintainer contact metadata is separate and remains part of the provider
information review. This prepares the local preview; it does not
establish publisher verification or complete the legal/public-release gates below.

For a different publisher, register a dedicated TradeFrame app in Microsoft Entra **App registrations**.
Copy **Application (client) ID** from that app's Overview page; the ID below
your profile name, the user/object ID and Directory (tenant) ID are not this value.
See Microsoft's [app registration guide](https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-register-app).
Enable personal Microsoft accounts (and organization accounts if desired),
enable **Allow public client flows** in Authentication, and add the delegated
Microsoft Graph `Notes.ReadWrite` permission. No client secret belongs in a
desktop application. Consent may depend on the account's organization policy.

An optional nonempty `TRADEFRAME_MICROSOFT_CLIENT_ID` overrides the default when
packaging, including as the repository Actions variable of the same name. An
empty/unset variable uses `package.json`'s public default, so ordinary builds on
all four runners keep OneNote available without additional repository settings.
The package embeds this public ID, so people downloading it can use **Connect OneNote** directly.
For a developer build without a publisher ID, Connections exposes a local
application-ID setup field. This field accepts only a UUID, never a client secret.

Existing custom IDs take priority over the packaged default. Do not rewrite
`onenote.json`, `onenote-token.bin`, `onenote-notebook.json` or `connections.json`
as part of an update. The authentication implementation and credential format are
unchanged. A normal version update must not call Configure, Disconnect or Begin
automatically. Tests cover retained credentials/notebook/jobs when a publisher
default is introduced and when the existing default is retained. Deliberately
changing the effective app ID can still require fresh authorization; tokens from
one registration must not be reassigned to another.

The connection uses Microsoft's [device authorization flow](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-device-code).
The app requests delegated `Notes.ReadWrite` and `offline_access`, creates pages
in the `TradeFrame` section of the notebook selected after sign-in, and searches
that section for its own delivery title before retrying a page creation. Notebook
and section discovery use the same permission. See [connections](SYNC.md).

## Required acceptance before publishing

On each claimed OS and architecture, use synthetic data to verify extraction,
launch with sandboxing enabled, capture permissions, source selection, repeated
screenshots with different required timeframes, captions/removal, save/reopen after restart, form persistence,
Obsidian and Dropbox together, a disconnected destination and retry, and OneNote
sign-in, notebook discovery/selection, page creation in that notebook, selection
after restart, switching notebooks, opening old/new OneNote setups as drafts,
post-connection send, interrupted multi-request upload/retry and disconnect. Inspect desktop and narrow-window layouts.
Terminate a process during a prepared screenshot append, reopen the file and
verify completion without duplicate captures; verify a live writer is left alone
and an external edit stops recovery. Test a hard-link-capable journal filesystem.
Verify a clean user data folder and that no private data appears in the archive.

Choose a project license before presenting the source as reusable open source.
Resolve trusted signing/notarization and installer requirements for a stable release.
Automatic updates, publisher account registration and public upload are not
performed by the package script.

## Native Linux verification, 5 November 2026

The generated 0.7.7 Linux x64 package was copied to a temporary directory, with
only that copy's sandbox helper linked to the already installed, verified
root-owned mode-4755 `/opt/google/chrome/chrome-sandbox`. This follows Chromium's
[existing-helper approach](https://chromium.googlesource.com/chromium/src/+/main/docs/security/apparmor-userns-restrictions.md).
Electron ignored the documented environment-variable alternative on this host;
the temporary link allowed actual native QA. The distribution and global
permissions/security settings are unchanged. This is test setup evidence, not
an installed-package test or a required end-user workaround.

The app ran on a private headless Sway display with an empty synthetic profile,
journal and destination folders. Native window preferences confirm sandbox and
context isolation enabled, Node integration disabled; renderers have no
`window.process`/`window.require`, use an isolated preload context and report
NoNewPrivs=1 and Seccomp=2. Actual Electron/React/preload/IPC, native image
operations, SQLite and file adapters were exercised. The test replaced only
capture-source input with a deterministic PNG and the open-file picker result
with a synthetic saved-note path. Production app files were unchanged.

| Verified flow       | Evidence                                                                                                                                                              |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rendered UI         | Inspected 1120x760 and 640x480 views, 680x128 capture bar and full-screen area selector; no horizontal overflow in the checked workspace views                        |
| Capture pipeline    | Actual letterbox-aware pointer selection and full-screen restoration; saved area 501x251 and automatic crop 1040x520 equal every expected bitmap pixel                |
| Save/append/copy    | Historical calendar folders, Unicode/multiline notes, two distinct timeframes, exact original-byte preservation, complete Markdown backup and numbered collision copy |
| Folder adapters     | Actual temporary Obsidian/Dropbox directories receive matching notes/images; eight completed delivery jobs persist                                                    |
| Local reopen/filing | Real file read/validation/IPC restores both images/timeframes; changed rules create a format-6 copy without moving previous notes                                     |
| Draft lifecycle     | Navigation retains fields; native close defaults to Keep editing; Escape preserves images and restores focus; confirmed New setup preserves saved files               |
| Restart/concurrency | Bridge-created form, rules, folders and jobs persist; cleared draft stays empty; second launch exits successfully and focuses one existing journal window             |

Follow-up native fault checks pause only the test process's filesystem calls at
intent publication, partial Markdown append and completed append before cleanup,
then terminate the actual Electron writer with SIGKILL. A fresh app process opens
the note through the real UI/IPC and recovers exact expected Markdown/PNG bytes,
two timeframes and multiline notes. Reopening again introduces no duplicates;
the backup remains exact and recovery files are cleaned. A live writer is left
alone, another calendar note remains usable, and divergent external text stops
recovery without changing the note, images, backup or recovery record/staging.
This verifies process termination on the local hard-link-capable filesystem;
power-loss durability and cross-device writers are not established.

Further native UI checks remove only a synthetic Obsidian root before Save:
local/Dropbox copies succeed, the failed job is visible, and Retry sync succeeds
after restoring that folder. A later external Dropbox edit survives follow-up
delivery and repeated UI retry, including after restart; Obsidian still receives
the new image. Every retry is observed to persist its completed job result.
These are real local folder adapters, with no Obsidian/Dropbox cloud client.

The capture fixture and picker override disappear on process restart. Without the
capture fixture, the initial private session had no working screen portal: capture showed
an actionable error, cleared busy state and restored both windows. No real
user desktop, journal, Microsoft account, cloud client or keyring was accessed. All QA
app/compositor processes were closed afterward. Synthetic screenshots and reports
are retained locally under ignored `release/qa-0.7.7-native/`, outside packages.

Actual portal follow-up uses a separate private D-Bus/PipeWire/wlr session and
WirePlumber's policy-only profile, without hardware monitors or host system-bus
access. The portal is configured for the sole synthetic headless output, rather
than an interactive picker. No capture/source/image result is replaced. All pixels
of the actual 1600x1000 source and saved Auto chart, pointer and keyboard crops
match independent expectations. UI save/append, Escape preservation, full-screen
restoration, real portal denial and a successful capture-bar retry pass. See
[capture evidence and its limits](CAPTURE.md#native-portal-verification-5-november-2026).

Remaining checks: unmodified archive/installed Debian launch on a supported host;
interactive OS/source picker, physical repeated capture, marker/quality/DPI/stacking;
assistive technology;
OneNote and actual Obsidian/Dropbox client/account flows; Windows/macOS. The
license, provider, legal, signing and owner publication decisions below also
remain open. Use synthetic data and an explicitly authorized account for the next
native/cloud checks; do not infer acceptance from this fixture run.

## OneNote cancellation repair, 0.7.7

Preview 0.7.7 retains Electron 45.2.2 and the same dependency/format/native
protection contracts. Session-generation guards now run before authentication
error handling for the shared page/resource reader and upload completion.
Existing post-await cancellation checks remain. This prevents a late HTTP 401
from an earlier session from clearing the current in-memory access token.

Four synthetic regressions reproduce the old failure; two additional scenarios
cover account changes during successful response checks. Formatting, both
TypeScript projects, production build and all 208 tests pass on Linux. The same
208 tests also pass under the embedded Node runtime. No real journal, credential
or Microsoft account was used. See [OneNote behavior](SYNC.md#onenote).

This does not establish native/cloud or Windows/macOS acceptance, and does not
close the license, provider, legal or owner publication gates below. The 0.7.6
runtime checks and installation behavior remain relevant to the unchanged engine;
the unmodified archive's sandbox-helper limitation remains open. The temporary-copy
native check above provides narrower renderer/IPC/file evidence.

## Runtime maintenance, 0.7.6

Preview 0.7.6 pins the existing Electron 45 runtime to **45.2.2**, with Chromium
**156.0.8078.80** and Node **24.22.2**. The
[upstream release](https://releases.electronjs.org/release/v45.2.2) includes a
Wayland hidden-parent crash fix and newer engine builds; preceding
[45.2.1](https://releases.electronjs.org/release/v45.2.1) and
[45.2.0](https://releases.electronjs.org/release/v45.2.0) include upstream engine
fixes. This follows Electron's advice to
[keep the bundled framework current](https://www.electronjs.org/docs/latest/tutorial/security).
It is not an upgrade to Electron 46 or an app API migration.

Lock changes are limited to the app version/root Electron pin, the root install
script marker and Electron's version/URL/integrity entry. Its declared
dependencies and all other resolved dependencies are
unchanged. Existing source/native window protections, journal/config/credential
formats and capture/delivery code are unchanged. No private data is involved in
the upgrade or its tests. Back up before installing and retain the normal
profile as described in [DATA](DATA.md); actual keyring/token acceptance after
this runtime change still needs the selected OS/account.

The official Linux artifact was first downloaded into an isolated candidate
directory using the installer's bundled checksums. It reports the expected
Electron/Chromium/Node versions and opens the form store in in-memory SQLite.
Formatting, both TypeScript projects, production build and all 202 tests pass
on Linux after the update. The full 202-test suite also passes in Electron's
embedded Node mode. Registry npm audit reports zero known vulnerabilities.

The packaged-runtime verifier now compares the executable's actual
`process.versions.electron` with `package.json`, rather than trusting only the
runtime's text version file and platform/architecture. A synthetic package with
a copied plain Node executable passed the previous verifier; the focused
regression now requires rejection with the version-mismatch error. No window,
account, real journal or existing profile is opened by that check.

A clean temporary `npm ci` initially succeeded without creating an Electron
executable. The explicit root postinstall fixes that provisioning gap and keeps
the current CI commands usable from a clean checkout. A repeated clean install
now runs the pinned installer and produces the expected 45.2.2 executable.
The full clean-source `npm ci` → `npm run check` chain also passes all 202 tests
on Linux. This uses the verified runtime cache, not a second independent download.

These results do not prove native renderer/window/capture/permission/keyring
behavior. Re-run desktop/narrow, real capture, focus/full-screen, existing
encrypted-sign-in retention and selected-account flows on every claimed OS.
Windows/macOS artifacts and native acceptance remain open. Linux archive
sandbox-helper ownership requirements are unchanged; no global security setting
or app sandbox was weakened. The source license, publisher/legal documents and
owner publication gates also remain open. A clean npm audit is not a full
Chromium/Node/Electron security clearance.
A fresh 0.7.6 archive launch on an isolated headless Wayland display aborts at the
sandbox-helper ownership/mode check. That result does not establish an installed
Debian-package launch or UI acceptance; those remain required on the target OS.

## Dependency review, 5 November 2026

The npm registry audit of the committed 0.7.5 lockfile identified one affected
direct development dependency: Vite 6.4.2, with seven advisory entries and an
aggregate high severity. Vite is now pinned to **6.4.5**, the same-series patch
recommended by that audit. During that Vite-only step, only the root Vite pin and
Vite's version, registry URL and integrity entry changed; other lock entries,
including Electron 45.0.0, stayed unchanged. The later runtime update is documented
above. No dependency or install-time script was added by the Vite patch.

A focused regression reproduces
[GHSA-rq7h-c2jc-7f22](https://github.com/vitejs/vite/security/advisories/GHSA-rq7h-c2jc-7f22)
on 6.4.2: transforming a project import wrongly allows an outside file whose
absolute path matches the import's root-relative URL. It passes on 6.4.5 using
only synthetic temporary files and Vite's middleware/permission API, with no
listening server. This non-Windows regression is skipped on Windows because that
advisory excludes it. The patch also includes the earlier
[Windows path-denial fix](https://github.com/vitejs/vite/security/advisories/GHSA-fx2h-pf6j-xcff);
no Windows exploit or native acceptance is claimed here. See the
[upstream 6.4.5 release](https://github.com/vitejs/vite/releases/tag/v6.4.5).

The follow-up npm audit reports **zero known vulnerabilities** for this exact
lockfile on this date. This is registry evidence, not a complete security audit:
it does not establish safety of bundled Chromium/Node, native capture, account
flows or every asset. Vite serves development only, binds to 127.0.0.1 in the
project command and is not bundled as a runtime module. Keep that bind address;
do not expose a development server with journals or credentials in its workspace.

Verification on Linux: formatting, both TypeScript projects, production build and
all 201 tests pass. A clean temporary `npm ci --ignore-scripts` resolves the lock
and passes the copied security regression; it does not exercise Electron's native
download/install script. The four production renderer files remain byte-identical
to the previous build. This patch does not establish fresh native/other-OS QA.

The subsequent [runtime maintenance step](#runtime-maintenance-076) updates and
checks Electron separately. Private vulnerability contact, supported versions,
incident process, full runtime security assessment and the other release gates
below remain unresolved.

## Release documentation and legal readiness

Research date: **2 November 2026**. Jurisdiction assumption: a publisher based in
Germany, distributing to Germany/EU through GitHub. The owner's stated plan is a
free, personally maintained public project, with a restriction on others making
money from it. The scope of that restriction is still undecided. This section is
a sourced preparation checklist, not final legal terms or a legal clearance.
Recheck time-sensitive sources immediately before publication; other countries,
stores or a changed business model can add requirements.

Implementation follow-up: the owner approved reusing the current working public
client ID for 0.7.2 preview packages. That build configuration does not resolve
the legal-document, account-eligibility or independent-account checks below.

### Current evidence and documents to prepare

The 5 November 2026 preparation step adds app-specific review drafts for privacy,
terms and provider information, plus a factual data-maintenance guide. They are
bundled as clearly labeled drafts so relative links also work in new packages;
they are not effective legal notices or approved Microsoft legal URLs. No project
`LICENSE` or `SECURITY.md` has been adopted. No publisher identity, address,
legal basis or support promise has been invented. The original legal research
date above is unchanged; the new drafts identify their own checked sources/date.

| Document or evidence                        | Purpose and release treatment                                                                                                                         | Current state                                                                                                                      |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Project `LICENSE`                           | Define allowed use, modification and redistribution for source and binaries; keep the README and package metadata consistent                          | Owner decision required; no license selected                                                                                       |
| Third-party notices                         | Preserve each bundled component's copyright/license obligations independently of TradeFrame's own license                                             | Package script includes Electron/Chromium notices and React/React DOM/Scheduler licenses; full dependency and asset review remains |
| Public privacy statement                    | Describe actual local storage, optional services, support/hosting data, recipients, retention and rights; make it reachable before connecting OneNote | [Review draft](PRIVACY_DRAFT.md); identity, processing roles/grounds, support retention, transfers and publication unresolved      |
| Public terms of use                         | Explain provider, journal-only purpose, permitted use, third-party connections, support and legally valid liability provisions                        | [Review draft](TERMS_DRAFT.md); license, provider, contractual model and liability review unresolved                               |
| Provider information / Impressum assessment | Determine applicable German identification duties and publish the necessary reachable information                                                     | [Preparation draft](PROVIDER_DRAFT.md); applicability, approved details and public URLs unresolved                                 |
| Security policy / contact                   | Provide a private vulnerability-reporting route, supported-version policy and incident handling                                                       | Recommended project document; Microsoft API security obligations also need a process                                               |
| User and release guides                     | Installation/uninstall/update, backup/export, compatibility, known limitations and supported OS evidence                                              | [Backup/update/removal guide](DATA.md) added to existing guides; native restoration and final package acceptance remain open       |

`PRIVACY_DRAFT.md`, `TERMS_DRAFT.md` and `PROVIDER_DRAFT.md` under `docs/` are the
authoritative preparation texts, not parallel final policies. `LICENSE` and
`SECURITY.md` remain proposed files. The owner must supply/approve the missing
identity, contact, licensing and operating decisions before the drafts can be
finalized. Their **Pending** sections deliberately keep these decisions open.

### License decision: commercial restrictions are not Apache 2.0

A public repository and a zero download price do not determine its license.
Apache 2.0 allows commercial use. An Open Source Definition-compliant license
cannot prohibit business use or selling copies. A commercial restriction means
describing the project as **source available**, rather than claiming OSI-defined
open source. Sources: [Apache licensing FAQ](https://www.apache.org/foundation/license-faq),
[OSI definition](https://opensource.org/osd) and
[OSI licensing FAQ](https://opensource.org/faq).

| Candidate                                   | Commercial use / selling copies                                   | Relevance to the owner's goal                                                                                                    |
| ------------------------------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Apache License 2.0                          | Allowed subject to its terms                                      | Suitable only if the owner accepts commercial reuse; does not implement a no-profit rule                                         |
| GPLv3                                       | Allowed; redistribution has applicable license/source obligations | Copyleft is not a commercial-use or resale ban                                                                                   |
| PolyForm Noncommercial 1.0.0                | Grants rights for its defined permitted noncommercial purposes    | Candidate for evaluation, not a selected license; personal-use wording excludes anticipated commercial application               |
| A narrowly drafted source-available license | Depends on the reviewed wording                                   | May be necessary if using the journal for one's own trades is allowed but selling the software or a hosted service is prohibited |

GPL source: [GNU licensing FAQ](https://www.gnu.org/licenses/gpl-faq.en.html#DoesTheGPLAllowMoney).
PolyForm source: [official versioned license text](https://github.com/polyformproject/polyform-licenses/blob/1.0.0/PolyForm-Noncommercial-1.0.0.md).

For a trading journal, distinguish **earning money by using the journal for
trading** from **earning money by selling/distributing/hosting the software**.
A blanket noncommercial choice could exclude intended users. Do not assume a
particular trader's use is legally noncommercial; resolve the exact scope before
adopting a license. Do not attach an extra no-commercial clause to Apache/GPL and
still present it as the unchanged standard license. Confirm rights to source,
icons, screenshots and outside contributions before licensing them.

Local metadata currently lists React, React DOM, Scheduler and Electron as MIT.
That is not a complete audit of the embedded Chromium/Node components or assets.
Keep upstream license texts intact; a TradeFrame restriction must not purport to
relicense those components. Preserve the existing package `LICENSE`,
`LICENSES.chromium.html` and `THIRD_PARTY_NOTICES.txt`. Include the approved own
license separately in future packages and verify the resulting artifacts.

### AGB, terms and liability are different from a software license

There is no general German obligation to create AGB. Standard terms, if used,
must be appropriately incorporated and legally valid; renaming them does not
remove that concern. A concise, reviewed terms page can explain this free app
without borrowing shop/subscription clauses that do not fit it.
Source: [ZDH guidance hosted by Handwerkskammer Dortmund](https://www.hwk-do.de/wp-content/uploads/2023/03/ZDH-Praxis-Recht-Hinweise-zu-allgemeinen-Geschaeftsbedingungen.pdf).

Do not promise that an English license's as-is clause eliminates all liability.
German consumer standard-term rules prohibit certain exclusions, including those
in [section 309 no. 7 BGB](https://www.gesetze-im-internet.de/bgb/__309.html).
Draft any liability language for the actual release model and obtain legal review.

Also assess whether the publisher acts as an entrepreneur and whether consumers
provide data as consideration. The digital-product rules can cover some
non-monetary contracts; the free/open-source exception in section 327(6) no. 6
has conditions. Do not assume a noncommercial/source-available license qualifies.
If monetization or data use changes, revisit consumer information, withdrawal,
warranty and update duties before release. Source:
[section 327 BGB](https://www.gesetze-im-internet.de/bgb/__327.html).

The terms should state the current product scope: recording charts and journal
entries, optional copies to user-selected destinations, and user responsibility
for lawful screenshot content and backups. Do not promise investment advice,
trading returns, guaranteed cloud availability or indefinite free support.
These descriptions do not replace mandatory rights or a classification review
if investment advice, broker execution or other regulated features are added.

### Provider information / Impressum

Check the public repository, release/download pages and any website/app-facing
legal links as an actual public offer. A free hobby label alone does not resolve
the assessment. Section 5 DDG addresses businesslike digital services and lists
provider identification/contact requirements where applicable. Section 18(1)
MStV separately covers offers not serving exclusively personal or family purposes.
Sources: [section 5 DDG](https://www.gesetze-im-internet.de/ddg/__5.html) and
[section 18 MStV, official state-law publication](https://www.gesetze-bayern.de/Content/Document/MStV-18).

Resolve applicability and the legally adequate contact/address arrangement before
publishing. A GitHub handle or contact form should not simply be assumed to meet
these duties. Do not publish the owner's private address without an explicit
decision. If required, provide a clearly labeled, directly accessible provider
notice rather than burying it in a source-code archive.

### Privacy statement grounded in the actual app

The source inspection supports this initial data-flow inventory; it is not a
packet-capture audit or a final GDPR role assessment:

| Flow                             | Current implementation                                                                                                                         | What the privacy/user documentation must explain                                                                                             |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Screenshots, answers and exports | Captured in memory; Markdown/PNG written to selected journal folders or retained as private app-profile working copies for delivery/follow-ups | Potential sensitive content, local paths, retained private working copies/backups, lack of automatic cleanup and shared-folder exposure      |
| App settings and credentials     | Form definitions/preferences/jobs in the app profile; refresh tokens protected by OS storage where available; session-only fallback otherwise  | Storage categories, purpose, retention, disconnect and manual cleanup; verify behavior on each OS                                            |
| Obsidian / Dropbox               | Writes local destination files; Dropbox's separately installed client handles cloud syncing                                                    | User's service choice and external provider; no direct Dropbox OAuth integration is claimed                                                  |
| OneNote                          | Direct Microsoft sign-in/Graph calls from the desktop app, with optional upload/download of setup fields and PNGs                              | Microsoft as recipient/service, account metadata, permissions and cloud retention; no TradeFrame backend currently receives journal contents |
| Help, downloads and support      | Opens external Microsoft help/login pages; GitHub hosts releases/issues                                                                        | Host/browser requests and any issue/support submissions are separate data flows; discourage publishing real journals or credentials          |

No app analytics, advertising or automatic crash-upload service was found in the
reviewed source. Do not convert that finding into a guarantee that GitHub,
Microsoft, Dropbox, the browser or the OS processes no metadata. Review any
hosting or publisher-account logs that become accessible to the owner as well.

Determine the actual controller/recipient roles and lawful processing grounds.
Where information duties apply, document provider/contact, purposes, legal bases,
data categories/recipients, transfers where relevant, retention, applicable user
rights and complaint routes. Make the notice accessible before relevant use and
from the app/release page. Local-first and free distribution alone do not resolve
the legal assessment. Source:
[Lower Saxony data-protection authority guidance for websites and apps](https://www.lfd.niedersachsen.de/dsgvo/informationen_fur_betreiber_von_webseiten/informationen-fur-betreiber-von-webseiten-und-apps-digitale-dienste-164589.html).

Assess device storage/access separately under
[section 25 TDDDG](https://www.gesetze-im-internet.de/ttdsg/__25.html), including its
strictly-necessary exception. Do not add a blanket consent checkbox or cookie
banner as a substitute for identifying actual purposes and legal grounds.

Explain separately: local disconnect, cancellation of pending transfers,
Microsoft grant revocation, deletion of app-profile credentials, deletion of
exports/backups and deletion of cloud pages. Current disconnect does not delete
previously saved user notes. Do not silently change that preservation behavior
to satisfy a generic template. Any cache/retention/deletion implementation gap
needs an explicit preservation plan and a separate approved change.

### Microsoft publisher documents and operational obligations

For the shared public registration, provide stable public HTTPS links to the
app's terms and privacy statement, consistent provider identity and a support
contact. Microsoft documents consent-screen alerts when either legal link is
missing. Verify these URLs from the actual consent screen of an independent
account; a Markdown file existing locally is insufficient. Source:
[Microsoft terms/privacy link configuration](https://learn.microsoft.com/en-us/entra/identity-platform/howto-add-terms-of-service-privacy-statement).

Publisher verification is a separate process with eligibility requirements; it
is not achieved by entering a display name or client ID. Organization policies
can require admin approval or block an unverified multitenant app. Do not promise
every personal/work/school account will work. Source:
[Microsoft publisher verification](https://learn.microsoft.com/en-us/entra/identity-platform/publisher-verification-overview).

Review the [Microsoft APIs Terms of Use](https://learn.microsoft.com/en-us/legal/microsoft-apis/terms-of-use),
especially sections 2–6, 9 and 10, before supplying the shared registration.
They require appropriate security, necessary permissions, a written privacy
statement, consent, retention/deletion practices and vulnerability/incident
processes. They also include suspension/termination and indemnity provisions;
being a private free project does not waive the publisher's agreement.

The privacy review must reconcile section 5's locally retained API-data rules
with imported copies, user-owned exports and uninstall behavior. Document a
compliant approach before claiming readiness; this research does not approve the
current behavior against every term. Include instructions for disabling access
and Microsoft's relevant grant-management pages. A local Disconnect button is
not proof of server-side revocation. Keep registration details current and
review changes to API terms during maintenance.

Disclose that `Notes.ReadWrite` is a user-notebook permission, not an OAuth grant
limited to the chosen TradeFrame notebook. `offline_access` supports retained
authorization. Sources: [Microsoft permission reference](https://learn.microsoft.com/en-us/graph/permissions-reference#notesreadwrite)
and the implemented scope in `electron/onenote.ts`. Keep the public client ID
separate from secret tokens; never bundle a client secret or user credentials.

### Conditional requirements and changing release models

**EU cybersecurity rules:** assess whether the actual distribution is within the
Cyber Resilience Act, rather than inferring an exemption from a free price or
GitHub hosting. The noncommercial free/open-source treatment needs assessment
against the selected license and activity; a source-available label is not a
legal conclusion. Main application is from **11 December 2027**. Manufacturer
reporting duties for in-scope products already apply from **11 September 2026**.
Do not mark conformity/CE/SBOM duties either mandatory or exempt for TradeFrame
without resolving scope. Sources: [Commission implementation timeline](https://digital-strategy.ec.europa.eu/en/factpages/cyber-resilience-act-implementation),
[official CRA summary](https://eur-lex.europa.eu/DE/legal-content/summary/horizontal-cybersecurity-requirements-for-products-with-digital-elements-cyber-resilience-act.html)
and [Commission reporting guidance](https://digital-strategy.ec.europa.eu/en/policies/cra-reporting).

**Product liability:** Directive (EU) 2024/2853 explicitly addresses software and
excludes free/open-source software outside commercial activity. Its transposition
deadline is **9 December 2026**. Recheck the applicable German implementation
and whether any exception fits a later release; a license disclaimer is not a
complete liability assessment. Source:
[official directive text](https://eur-lex.europa.eu/legal-content/EN/TXT/PDF/?uri=CELEX%3A32024L2853).

**Accessibility and commerce:** BFSG covers specified products/services, not
every app merely because it is software. Reassess scope if the offering adds
covered services or consumer checkout; preserve keyboard, focus and reduced-motion
support regardless. Source: [Federal Accessibility Agency BFSG overview](https://www.bundesfachstelle-barrierefreiheit.de/DE/Barrierefreiheitsstaerkungsgesetz/barrierefreiheitsstaerkungsgesetz_node.htm).

Paid downloads, subscriptions, advertising, selling/collecting user data, hosted
accounts, analytics, broker connections or app-store distribution require a new
assessment of contracts, privacy, service policies and applicable obligations.
No finding here grants a blanket exemption for future business models.

### Documentation and evidence gate for the first public release

These boxes remain open until the indicated decision or evidence exists. The
research itself does not complete them.

- [ ] Owner resolves resale/hosting restrictions versus use for personal or
      professional trading, selects the actual license and approves accurate
      open-source/source-available wording.
- [ ] Rights to code, contributions and visual assets are confirmed; dependency
      notices and the approved own license are included in source and every package.
- [ ] Provider/Impressum applicability, lawful contact details and release model
      are assessed; required provider information is publicly reachable.
- [ ] App-specific privacy and terms texts are reviewed, versioned and publicly
      hosted; any legal conclusions needing professional review are resolved.
- [ ] Local/cloud retention, deletion, export and revocation instructions match
      the app and Microsoft terms; gaps are resolved without silently deleting notes.
- [ ] Public Microsoft registration, identity, support/legal URLs, permission
      scope and verification limitations are checked using an independent account.
- [ ] Vulnerability contact, dependency review, supported versions and response
      process are documented; applicable security-law duties are assessed.
- [ ] Installation, update, uninstall, backup/restore and known limitations are
      documented; new format-6 notes require TradeFrame 0.7.0 or later.
- [ ] Each claimed OS/architecture has actual desktop/capture/save/cloud/unload
      acceptance, matching artifacts/checksums and an explicit signing status.
- [ ] README DE/EN, release notes, bundled guides and published legal pages agree
      with the exact version being released; no placeholder details remain.
- [ ] The owner reviews the concrete source/artifacts and publishes the release;
      no private plans, account credentials, real journals or screenshots are uploaded.

Recommended next decisions: first settle the license restriction, then the
publisher/contact and legal-hosting details, then complete/review the linked
privacy, terms and provider drafts against the actual publisher operations. A legal professional should review the
nonstandard licensing/usage boundary and unresolved German/EU applicability
before the owner treats this as a legally cleared public offer.
