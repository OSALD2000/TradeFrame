# TradeFrame privacy notice — review draft

**Draft dated 5 November 2026 for preview 0.7.7. Not an effective privacy notice.**
The data-flow description below is based on the source code. The publisher must
complete the identified legal/contact details, review applicability and approve
the notice before public distribution. No real journal or account was inspected.
Publication gates remain in [RELEASE](RELEASE.md#documentation-and-evidence-gate-for-the-first-public-release).

## Publisher and privacy contact

**Pending:** insert the approved controller's legal identity, address and privacy
contact, representative/data-protection officer where applicable, and effective
date. Use the same approved identity as the [provider notice draft](PROVIDER_DRAFT.md).
The GitHub account name alone does not identify a legal controller.

## What TradeFrame does with your data

TradeFrame is a desktop journal. You choose the screen/window to capture, enter
setup answers and image notes, and choose where to save them. Screenshots can
include account information or other personal content visible on that source;
review it before saving or sending. Chart detection and area cropping run locally.
Unsaved fields and screenshots stay in memory and can be lost on closing/crash.

The app writes Markdown/PNG notes to the folders you select and stores form
definitions, filing preferences, folder paths and delivery metadata in its local
profile. Data can include trading dates/results, tags, capture timestamps,
free-text notes, notebook IDs/names and custom field labels/options. The app does
not require a TradeFrame-hosted account. The reviewed implementation has no
TradeFrame server receiving journal contents, advertising, analytics or automatic
crash-upload integration. This source review is not a network-traffic audit and
does not describe all processing by your OS or external services.

**Turning off Local journal does not mean that no copy stays on your device.**
A private working copy of the Markdown and images stays in the app profile for
retries and follow-up screenshots, even when OneNote is the only selected target.
There is no automatic cleanup. OS file permissions are used where supported;
the contents are not encrypted by TradeFrame. See [data locations, backup and removal](DATA.md).

## Optional destinations and recipients

At least one destination must be checked before saving. Initially only Local
journal is checked. Checking a connected destination sends that saved version
there; unchecking it does not cancel an earlier pending job. Saved metadata and
backups remain until removed or, for some completed job metadata, pruned by later
saves. Tracked delivery metadata does not itself expire a saved note or page.

- **Local journal and Obsidian:** TradeFrame writes files to the folder you
  select. Anyone with access to that folder, its backups or a separately
  configured sync/sharing service may be able to read them. TradeFrame does not
  authenticate to an Obsidian account.
- **Dropbox:** TradeFrame writes to your chosen local folder. The separately
  installed Dropbox client handles cloud sync under your account/settings;
  TradeFrame has no direct Dropbox API login. Consult the service's
  [privacy policy](https://www.dropbox.com/privacy) before using it.
- **OneNote/Microsoft:** if you connect OneNote, the desktop app contacts
  `login.microsoftonline.com` for authorization/tokens and `graph.microsoft.com`
  for notebook/page discovery, upload and download. Microsoft receives the
  request data and network metadata needed for those requests. Sign-in in your
  external browser is handled by Microsoft. The app requests delegated
  `Notes.ReadWrite` and `offline_access`; review the permission screen because
  the grant is broader than the app's chosen TradeFrame section. Saves send
  fields, tags, PNGs and a restoration attachment containing original Markdown
  and image hashes to your chosen notebook. Retrying can read an existing page's
  snapshot/images to verify what already arrived. Opening a setup downloads it
  into a draft. Your notebook's sharing rules also apply. Consult
  [Microsoft's privacy statement](https://privacy.microsoft.com/en-us/privacystatement).

Access tokens are held in memory. A refresh token is saved only using supported
OS-backed encryption; otherwise sign-in is session-only. The renderer does not
receive passwords or tokens. Encryption of the saved token does not encrypt the
journal or uploaded pages. [Authentication and delivery details](SYNC.md#onenote)

Opening help/sign-in links contacts the linked provider in your browser.
Downloading releases, reading the repository or submitting an issue involves
GitHub separately from the installed journal. Public issues/attachments can be
read by others. Prefer synthetic examples and remove account details, notebook
IDs, personal paths and credentials before sharing diagnostics. Consult
[GitHub's privacy statement](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement).

## Retention and control

Notes, screenshots, private working copies and Markdown backups have no automatic
expiry. Settings and pending/failed delivery jobs persist across restarts.
Completed job metadata can remain in the profile; disconnect is not a profile
wipe. The app retains no recoverable unsaved draft after process exit.

Disconnecting cancels outstanding deliveries for that destination but leaves
already saved files/pages. OneNote disconnect removes the local saved token and
notebook choice, but does not revoke Microsoft's grant or delete cloud content.
Delete each local/cloud/backup copy separately using the
[removal instructions](DATA.md#stop-delivery-and-remove-data). Shared services
may retain trash, versions or organizational backups according to their own
rules. Uninstalling the program alone does not remove journal/profile data.

## Legal grounds, international transfers and your rights

**Pending legal review:** determine the publisher's actual processing role for
each flow, including the shared Microsoft registration, downloads and support.
Document each applicable purpose and legal basis; identify any legitimate
interests, recipients/processors, non-EEA transfers and safeguards. Do not infer
a GDPR legal basis simply from Microsoft's authorization screen. Confirm what
publisher-accessible hosting/registration logs actually exist and how long
support data is retained. No such retention period is approved in this draft.

Where applicable, the final notice must explain access, rectification, erasure,
restriction, portability, objection, withdrawal of consent and complaints to a
supervisory authority, including an effective contact route. Confirm the
competent authority and any representative/DPO obligations. State whether data
is required and the consequences of not providing it: local journaling does not
require OneNote, but cloud features need the selected service and its permissions.
The app does not implement automated trading decisions, user profiling or broker
execution; local chart cropping only chooses an image rectangle.

These are unfinished notice fields, not a claim that rights or information duties
are inapplicable. The final text must match actual publisher operations as well
as the app. The [Irish Data Protection Commission's transparency guidance](https://www.dataprotection.ie/en/individuals/know-your-rights/right-be-informed-transparency-article-13-14-gdpr)
sets out the identity, purpose, recipient, retention and rights information to
consider under GDPR Articles 13/14. Publish an approved, accessible notice before
the relevant processing and link it from the release and OneNote registration.
