# Download packages and verification

TradeFrame is an early desktop preview. Linux packaging can be built locally;
Windows and macOS packages must be built and tested on their respective systems.
These packages are unsigned. No public release has been made by the agent.

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
only, or when the owner pushes a version tag such as `v0.2.0`. The tag must match
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
git tag v0.2.0
git push origin v0.2.0
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
in the `TradeFrame` section of the default notebook, and searches for its own
delivery title before retrying a page creation. See [connections](SYNC.md).

## Required acceptance before publishing

On each claimed OS and architecture, use synthetic data to verify extraction,
launch with sandboxing enabled, capture permissions, source selection, repeated
screenshots with different required timeframes, captions/removal, save/reopen after restart, form persistence,
Obsidian and Dropbox together, a disconnected destination and retry, and OneNote
sign-in/page creation/disconnect. Inspect desktop and narrow-window layouts.
Terminate a process during a prepared screenshot append, reopen the file and
verify completion without duplicate captures; verify a live writer is left alone
and an external edit stops recovery. Test a hard-link-capable journal filesystem.
Verify a clean user data folder and that no private data appears in the archive.

Choose a project license before presenting the source as reusable open source.
Resolve trusted signing/notarization and installer requirements for a stable release.
Automatic updates, publisher account registration and public upload are not
performed by the package script.
