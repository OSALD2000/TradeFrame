import { useEffect, useState } from 'react';
import type { CaptureAPI, OneNoteState } from '../electron/capture-types';

export function OneNoteConnection({ api, busy }: { api: CaptureAPI | undefined; busy: boolean }) {
  const [state, setState] = useState<OneNoteState | null>(null);
  const [working, setWorking] = useState(false);
  const [clientId, setClientId] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    if (busy) return;
    let active = true;
    api?.getOneNote().then((next) => { if (active) setState(next); }).catch(() => { if (active) setError('Could not load OneNote. Try again after restarting.'); });
    return () => { active = false; };
  }, [api, busy]);
  useEffect(() => {
    if (!api || !state?.login) return;
    let active = true;
    const timer = window.setInterval(() => {
      api.pollOneNote().then((next) => { if (active) setState(next); })
        .catch(() => { if (active) setError('Could not check sign-in. Check your connection.'); });
    }, 2000);
    return () => { active = false; window.clearInterval(timer); };
  }, [api, state?.login?.userCode]);
  async function update(action: () => Promise<OneNoteState>) {
    setWorking(true); setError('');
    try { setState(await action()); }
    catch { setError('Could not update OneNote. Check your network and Microsoft application configuration.'); }
    finally { setWorking(false); }
  }
  return <div className="onenote-connection">
    <div className="connection-row">
      <div><h3>OneNote</h3><p>{state?.connected ? `Connected${state.durable ? '' : ' for this session'} · ${state.section}` : state?.login ? 'Waiting for Microsoft sign-in' : 'Not connected'}</p>
        <p>New saves send your fields and screenshots to the TradeFrame section in your default Microsoft notebook.</p>
      </div>
      <div className="connection-actions">
        {state?.connected || state?.login
          ? <button className="secondary-button" disabled={!api || busy || working} onClick={() => api && update(api.disconnectOneNote)}>{state.login ? 'Cancel sign-in' : 'Disconnect'}</button>
          : <button className="secondary-button" disabled={!api || !state?.configured || busy || working} onClick={() => api && update(api.connectOneNote)}>Connect OneNote…</button>}
      </div>
    </div>
    {state?.login && <div className="microsoft-login" role="status">
      <p>Enter this code at microsoft.com/devicelogin:</p><strong className="login-code">{state.login.userCode}</strong>
      <button className="secondary-button" disabled={!api} onClick={() => api?.openMicrosoftLogin().catch(() => setError('Open microsoft.com/devicelogin in your browser to sign in.'))}>Open Microsoft sign-in</button>
      <p>Expires at {new Date(state.login.expiresAt).toLocaleTimeString()}. Keep this window open; connection is checked automatically.</p>
    </div>}
    {state && !state.configured && <details className="publisher-settings">
      <summary>OneNote setup required for this build</summary>
      <p>The publisher needs to register TradeFrame with Microsoft. An application ID is public; never enter a password or client secret here.</p>
      <form onSubmit={(event) => { event.preventDefault(); if (api) void update(() => api.configureOneNote(clientId.trim())); }}>
        <label>Microsoft application ID<input required value={clientId} maxLength={36} spellCheck={false} autoComplete="off" placeholder="00000000-0000-0000-0000-000000000000" onChange={(event) => setClientId(event.target.value)} /></label>
        <button className="secondary-button" disabled={!api || busy || working} type="submit">Configure OneNote</button>
      </form>
    </details>}
    {state?.connected && !state.durable && <p className="preview-note">Sign-in is kept only until you close the app. Unlock a supported system keyring to keep it securely across restarts.</p>}
    {(error || state?.error) && <p className="save-message" role="alert">{error || state?.error}</p>}
  </div>;
}
