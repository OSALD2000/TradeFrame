# Get started with TradeFrame

The in-app **Setup guide** is available from the sidebar and the empty journal's
first-use link. It covers the same workflow without requiring an account.

## Local journal and screenshots

1. In **Connections**, choose the **Local journal** folder, or choose it on your
   first save. Keep the Markdown note and its linked images together.
2. Optionally expand **Folder structure & file name** for each folder destination. Choose
   and reorder folder/name blocks, review the example, then **Save rules**.
   These choices apply to new Trading journal notes. Existing notes retain their
   saved filing choices; older/custom forms keep their established layout.
3. In **Create setup**, open the capture bar and click **Screenshot**. Choose the
   intended source if asked. Record a timeframe on every image, such as `1m` or
   `2m`; screenshot notes are optional.
4. Complete the form. **Market date** is the day being documented, including a
   historical backtest. Review destinations and save. Inspect the local result
   separately from each transfer result.
5. Use **Open setup** to continue a saved note. **Append screenshots** preserves
   earlier fields/images. Use **Save copy** when changing them. Neither operation
   relocates an existing note after a preferences change.

## Obsidian and Dropbox

Choose an Obsidian vault or a folder managed by the signed-in Dropbox desktop app
in **Connections**. Both may be connected together. Obsidian needs no plugin.
TradeFrame writes local files; Dropbox's desktop client handles cloud delivery.
The default subfolder is `TradeFrame`; new-note filing rules can change it.
Changing/resetting a connection does not move or delete previously saved files.

## OneNote

The packaged 0.7.2 preview includes TradeFrame's public application ID. Start with
**Connect OneNote** and the sign-in steps below; no app registration or ID entry
is needed. The Microsoft application ID controls remain available as advanced
settings. Keep an existing custom ID to preserve its connection across updates.

If the build already supplies a Microsoft application ID, skip registration.
Otherwise register an app in [Microsoft Entra](https://entra.microsoft.com/):

1. Open **Entra ID → App registrations → New registration**. Use a meaningful
   name, such as TradeFrame. For this app's common endpoint, enable organizational
   directories and personal Microsoft accounts in the supported account types.
2. In **Authentication**, enable **Allow public client flows** for device-code
   sign-in. Do not create or enter a client secret.
3. Under **API permissions → Microsoft Graph → Delegated permissions**, add
   `Notes.ReadWrite`. The app requests `offline_access` during sign-in. Tenant
   policy may require administrator approval.
4. Copy **Application (client) ID** from the app registration's Overview.
   Your profile/user/object ID and directory/tenant ID are different values.
   Save the public client ID under **Connections → Microsoft application ID**;
   it can be corrected or removed there later.

Microsoft references: [registration](https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-register-app),
[public-client flows](https://learn.microsoft.com/en-us/entra/identity-platform/msal-client-applications),
[device authorization](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-device-code),
[OneNote permission](https://learn.microsoft.com/en-us/graph/permissions-reference#notesreadwrite).

Then connect from TradeFrame:

1. Choose **Connect OneNote**, open Microsoft's sign-in page, enter the displayed
   code, use the intended account and review consent.
2. Create/open a notebook in [OneNote](https://onenote.cloud.microsoft/notebooks)
   with the same account if needed. Any notebook name works.
3. **Refresh notebooks** in Connections and select one. New pages go into its
   `TradeFrame` section, created during delivery if missing.
4. Save a setup, or use **Send saved setup to OneNote** for an already saved file.
   Verify the destination result. Failed delivery never undoes the local save.
5. Use **Open setup → Browse OneNote setups** to restore fields/images as a new
   draft. Saving creates a new local copy; the original cloud page is preserved.

Session-only sign-in indicates unavailable secure storage: start/unlock the OS
keyring and review Connections. Switching notebooks or disconnecting cancels
pending OneNote deliveries and leaves existing pages intact. Details: [SYNC](SYNC.md).

## Statistics and desktop menu

**Statistics** is an explicitly labeled **Coming soon** area. This release does
not calculate or display performance metrics.

The in-window File/Edit/View/Window bar is hidden by default on Linux/Windows.
Press Alt to reveal it temporarily; editing shortcuts remain available. macOS
retains its normal operating-system menu. The app's native save/close dialogs
preserve their existing save/close choices. Draft replacement and close/reload
confirmations match the app design; Keep editing or Escape cancels them without
discarding the draft. File/folder selection remains an operating-system dialog.

## Compatibility

Notes with configured filing snapshots use format 6 and need TradeFrame 0.7.0 or later.
Old notes remain readable and are not rewritten merely by opening them. More
details: [JOURNAL](JOURNAL.md), [filing decision](adr/0007-snapshot-filing-rules-for-new-setups.md).

Before updating or uninstalling, see [backup, restoration and data removal](DATA.md).
Unchecking Local journal still retains private working copies; uninstalling or
disconnecting does not remove all local/cloud copies.
