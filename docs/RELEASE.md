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
only, or when the owner pushes a version tag such as `v0.6.3`. The tag must match
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
git tag v0.6.3
git push origin v0.6.3
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

Register a dedicated TradeFrame app in Microsoft Entra **App registrations**.
Copy **Application (client) ID** from that app's Overview page; the ID below
your profile name, the user/object ID and Directory (tenant) ID are not this value.
See Microsoft's [app registration guide](https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-register-app).
Enable personal Microsoft accounts (and organization accounts if desired),
enable **Allow public client flows** in Authentication, and add the delegated
Microsoft Graph `Notes.ReadWrite` permission. No client secret belongs in a
desktop application. Consent may depend on the account's organization policy.

Set the public application/client UUID as `TRADEFRAME_MICROSOFT_CLIENT_ID` when
packaging, or as the repository Actions variable of the same name. The package
embeds this public ID, so people downloading it can use **Connect OneNote** directly.
For a developer build without a publisher ID, Connections exposes a local
application-ID setup field. This field accepts only a UUID, never a client secret.

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

## Release documentation and legal readiness

Research date: **2 November 2026**. Jurisdiction assumption: a publisher based in
Germany, distributing to Germany/EU through GitHub. The owner's stated plan is a
free, personally maintained public project, with a restriction on others making
money from it. The scope of that restriction is still undecided. This section is
a sourced preparation checklist, not final legal terms or a legal clearance.
Recheck time-sensitive sources immediately before publication; other countries,
stores or a changed business model can add requirements.

### Current evidence and documents to prepare

The source review found no project `LICENSE`, privacy statement, terms of use,
provider notice or `SECURITY.md`. Existing public technical guides and the package
notice generation are a useful starting point, not substitutes for these texts.

| Document or evidence                        | Purpose and release treatment                                                                                                                         | Current state                                                                                                                      |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Project `LICENSE`                           | Define allowed use, modification and redistribution for source and binaries; keep the README and package metadata consistent                          | Owner decision required; no license selected                                                                                       |
| Third-party notices                         | Preserve each bundled component's copyright/license obligations independently of TradeFrame's own license                                             | Package script includes Electron/Chromium notices and React/React DOM/Scheduler licenses; full dependency and asset review remains |
| Public privacy statement                    | Describe actual local storage, optional services, support/hosting data, recipients, retention and rights; make it reachable before connecting OneNote | Not written or published                                                                                                           |
| Public terms of use                         | Explain provider, journal-only purpose, permitted use, third-party connections, support and legally valid liability provisions                        | Not written; coordinate with the selected license                                                                                  |
| Provider information / Impressum assessment | Determine applicable German identification duties and publish the necessary reachable information                                                     | Applicability and approved publisher details unresolved                                                                            |
| Security policy / contact                   | Provide a private vulnerability-reporting route, supported-version policy and incident handling                                                       | Recommended project document; Microsoft API security obligations also need a process                                               |
| User and release guides                     | Installation/uninstall/update, backup/export, compatibility, known limitations and supported OS evidence                                              | README DE/EN, GETTING_STARTED, JOURNAL, SYNC and release notes exist; final package acceptance remains open                        |

Suggested filenames such as `LICENSE`, `PRIVACY.md`, `TERMS.md` and `SECURITY.md`
above are a proposed document set, not files created or terms accepted by this
research. Do not invent a legal name, postal address, email, retention period,
hosting URL or promised support lifetime. The owner must supply/approve them.

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

| Flow                             | Current implementation                                                                                                                        | What the privacy/user documentation must explain                                                                                             |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Screenshots, answers and exports | Captured in memory; Markdown/PNG written to the user's selected folders                                                                       | Potential sensitive content, local paths, backups and shared-folder exposure                                                                 |
| App settings and credentials     | Form definitions/preferences/jobs in the app profile; refresh tokens protected by OS storage where available; session-only fallback otherwise | Storage categories, purpose, retention, disconnect and manual cleanup; verify behavior on each OS                                            |
| Obsidian / Dropbox               | Writes local destination files; Dropbox's separately installed client handles cloud syncing                                                   | User's service choice and external provider; no direct Dropbox OAuth integration is claimed                                                  |
| OneNote                          | Direct Microsoft sign-in/Graph calls from the desktop app, with optional upload/download of setup fields and PNGs                             | Microsoft as recipient/service, account metadata, permissions and cloud retention; no TradeFrame backend currently receives journal contents |
| Help, downloads and support      | Opens external Microsoft help/login pages; GitHub hosts releases/issues                                                                       | Host/browser requests and any issue/support submissions are separate data flows; discourage publishing real journals or credentials          |

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
publisher/contact and legal-hosting details, then draft the actual privacy and
terms texts from the verified data flows. A legal professional should review the
nonstandard licensing/usage boundary and unresolved German/EU applicability
before the owner treats this as a legally cleared public offer.
