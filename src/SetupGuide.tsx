import { useEffect, useState } from 'react';
import type { SetupGuideAPI, SetupHelpTopic } from '../electron/capture-types';

export function SetupGuide({ api }: { api: SetupGuideAPI | undefined }) {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!api) return;
    let active = true;
    api
      .getOneNote()
      .then((state) => {
        if (active) setConfigured(state.configured);
      })
      .catch(() => {
        if (active) setError('Open Connections to check your current Microsoft configuration.');
      });
    return () => {
      active = false;
    };
  }, [api]);
  async function open(topic: SetupHelpTopic) {
    setError('');
    try {
      await api?.openSetupHelp(topic);
    } catch {
      setError('Could not open the browser. Use the website address shown in this guide.');
    }
  }
  return (
    <section className="setup-guide" aria-label="First-use and OneNote guide">
      <div className="guide-intro">
        <span className="preview-badge">Start here</span>
        <h2>Choose where your setups go.</h2>
        <p>
          You can capture and save without any account. Obsidian, Dropbox and OneNote are optional
          destinations.
        </p>
        <a className="capture-button" href="#connections">
          Choose your destinations
        </a>
      </div>
      <section className="guide-section" aria-labelledby="guide-first-setup">
        <h2 id="guide-first-setup">Your first setup</h2>
        <ol className="guide-steps">
          <li>
            <strong>Choose your destinations</strong>
            <p>
              Open Connections to connect the destinations you want. For Local journal, choose a
              folder now or on your first save there. Every destination is optional individually;
              choose at least one when saving. Keep saved Markdown notes and their images together.
            </p>
          </li>
          <li>
            <strong>Review filing rules (optional)</strong>
            <p>
              The defaults work without configuration. Expand Folder structure &amp; file name when
              you want a different layout. Arrange the blocks and review the example, then Save
              rules. These rules apply to new Trading journal notes; older/custom forms retain their
              established layout.
            </p>
          </li>
          <li>
            <strong>Capture your chart</strong>
            <p>
              In Create setup, enable Auto, then use your trading app’s Copy chart image command.
              TradingView: Linux / Windows Ctrl+Shift+S; macOS Cmd+Shift+S. New PNG clipboard images
              from any app are added while Auto is on. Use Edit image on a screenshot to crop it;
              release or press Enter twice to apply, or Escape to cancel. Clipboard images are kept
              whole until you edit them. Each screenshot needs its own timeframe, such as 1m or 2m;
              notes are optional.
            </p>
          </li>
          <li>
            <strong>Describe and save</strong>
            <p>
              Enter the market date, instrument, direction, model and result. Market date is the
              trading day you are documenting, including backtests. Check at least one save
              destination, then Save setup. Local journal is optional too; without it, a private
              recovery copy remains on this device for retries. The result shows local saving
              separately from each transfer.
            </p>
          </li>
          <li>
            <strong>Continue safely</strong>
            <p>
              Open a local setup to add follow-up screenshots. Append keeps earlier fields and
              images unchanged; use Save copy when changing them. Keep all linked images beside the
              Markdown note.
            </p>
          </li>
        </ol>
        <a href="#journal">Create your first setup →</a>
      </section>
      <section className="guide-section" aria-labelledby="guide-folders">
        <h2 id="guide-folders">Obsidian &amp; Dropbox</h2>
        <p>
          For Obsidian, choose your vault in Connections. No plugin is needed. For Dropbox, choose a
          folder managed by its installed, signed-in desktop app. TradeFrame writes local files;
          Dropbox handles cloud delivery.
        </p>
        <p>
          You can connect several destinations together. Changing a destination does not move
          previous files. Check each save result and use Retry sync when a destination is
          unavailable.
        </p>
      </section>
      <section className="guide-section" aria-labelledby="guide-onenote">
        <h2 id="guide-onenote">Connect OneNote, step by step</h2>
        {configured && (
          <p className="guide-callout">
            A Microsoft application ID is configured. Continue to sign-in, or review the
            registration steps if it is not an Application (client) ID.
          </p>
        )}
        <details className="guide-registration" open={configured === false}>
          <summary>Register a Microsoft app if no application ID is provided</summary>
          <p>
            Advanced setup for a build without a publisher-provided ID. An Entra directory with
            permission to register apps is required; organization policies may require an
            administrator.
          </p>
          <ol className="guide-steps">
            <li>
              <strong>Create an app registration</strong>
              <p>
                At entra.microsoft.com, open Entra ID → App registrations → New registration. Name
                it TradeFrame. For the app's common sign-in endpoint, choose Accounts in any
                organizational directory and personal Microsoft accounts.
              </p>
              <button
                className="secondary-button"
                type="button"
                disabled={!api}
                onClick={() => void open('entra')}
              >
                Open Microsoft Entra
              </button>
            </li>
            <li>
              <strong>Enable public-client sign-in</strong>
              <p>
                In Authentication, enable Allow public client flows. This desktop app uses
                device-code sign-in. Do not create or enter a client secret.
              </p>
            </li>
            <li>
              <strong>Add the delegated OneNote permission</strong>
              <p>
                In API permissions → Add a permission → Microsoft Graph → Delegated permissions, add
                Notes.ReadWrite. TradeFrame requests offline_access during sign-in to retain a
                session where secure storage is available. Organization approval may still be
                required.
              </p>
              <button
                className="secondary-button"
                type="button"
                disabled={!api}
                onClick={() => void open('permissions')}
              >
                Microsoft permission reference
              </button>
            </li>
            <li>
              <strong>Copy Application (client) ID</strong>
              <p>
                Copy the ID from your app registration's Overview. The ID below your profile name,
                User/Object ID and Directory/Tenant ID are different. Paste the public Application
                (client) ID into Connections → Microsoft application ID and save it. You can change
                or remove it there later.
              </p>
            </li>
          </ol>
          <button
            className="secondary-button"
            type="button"
            disabled={!api}
            onClick={() => void open('registration')}
          >
            Microsoft registration guide
          </button>
        </details>
        <ol className="guide-steps">
          <li>
            <strong>Sign in from TradeFrame</strong>
            <p>
              In Connections, choose Connect OneNote. Open Microsoft's sign-in page with the button
              there, enter the displayed code, use the intended account and review the requested
              consent.
            </p>
          </li>
          <li>
            <strong>Choose a notebook</strong>
            <p>
              Create or open a notebook in OneNote with that same account if needed. Its name is
              your choice. Back in Connections, Refresh notebooks and select the desired notebook.
              TradeFrame creates its TradeFrame section during delivery.
            </p>
            <button
              className="secondary-button"
              type="button"
              disabled={!api}
              onClick={() => void open('notebooks')}
            >
              Open OneNote notebooks
            </button>
          </li>
          <li>
            <strong>Save and check the result</strong>
            <p>
              Check OneNote under Save destinations to send a copy to the chosen notebook. For an
              already saved setup, use Send saved setup to OneNote. If it fails, the saved journal
              or private recovery copy stays available; review Connections and retry.
            </p>
          </li>
          <li>
            <strong>Open a cloud setup</strong>
            <p>
              Open setup → Browse OneNote setups lists the selected notebook's TradeFrame pages.
              Opening restores fields and screenshots as a separate draft. Saving creates a copy in
              your selected destinations; it does not overwrite the cloud page. Without Local
              journal, a private recovery copy still stays on this device.
            </p>
          </li>
        </ol>
        <p className="preview-note">
          If Connections says sign-in lasts this session only, start or unlock your system keyring.
          Notebook switching and disconnecting cancel pending OneNote deliveries; existing pages
          remain.
        </p>
        <a href="#connections">Open Connections →</a>
      </section>
      {error && (
        <p className="save-message" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
