import { useEffect, useState } from 'react';
import type { CaptureAPI, OneNoteState } from '../electron/capture-types';

export function OneNoteConnection({ api, busy }: { api: CaptureAPI | undefined; busy: boolean }) {
  const [state, setState] = useState<OneNoteState | null>(null);
  const [working, setWorking] = useState(false);
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
  useEffect(() => {
    if (api && state?.connected) void update(api.refreshOneNoteNotebooks);
  }, [api, state?.connected]);
  async function update(action: () => Promise<OneNoteState>) {
    setWorking(true); setError('');
    try { setState(await action()); }
    catch { setError('Could not update OneNote. Check your network and Microsoft application configuration.'); }
    finally { setWorking(false); }
  }
  return <div className="onenote-connection">
    <div className="connection-row">
      <div><h3>OneNote</h3><p>{state?.connected ? `Connected${state.durable ? '' : ' for this session'} · ${state.section}` : state?.login ? 'Waiting for Microsoft sign-in' : 'Not connected'}</p>
        <p>Choose the notebook for new saves below. Pages go into its TradeFrame section.</p>
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
    {state?.connected && <OneNoteNotebookPicker state={state} disabled={!api || busy || working}
      onRefresh={() => update(api!.refreshOneNoteNotebooks)} onSelect={(id) => update(() => api!.selectOneNoteNotebook(id))} />}
    {state && <OneNoteApplicationSettings state={state} disabled={!api || busy || working}
      onConfigure={(id) => update(() => api!.configureOneNote(id))} />}
    {state?.connected && !state.durable && <p className="preview-note">Sign-in is kept only until you close the app. Unlock a supported system keyring to keep it securely across restarts.</p>}
    {(error || state?.error) && <p className="save-message" role="alert">{error || state?.error}</p>}
  </div>;
}

export function OneNoteApplicationSettings({ state, disabled, onConfigure }: {
  state: OneNoteState; disabled: boolean; onConfigure(id: string): Promise<void>;
}) {
  const [clientId, setClientId] = useState(state.applicationId);
  useEffect(() => { setClientId(state.applicationId); }, [state.applicationId]);
  return <details className="publisher-settings" open={!state.configured || !!state.error}>
    <summary>Microsoft application ID · change or remove</summary>
    <p>Use the Application (client) ID from Entra ID → App registrations → your TradeFrame app → Overview.
      A user/object ID or directory/tenant ID will not work. Never enter a password or client secret.</p>
    <p>Changing or removing your custom ID disconnects OneNote and cancels pending OneNote deliveries. Existing notes and pages stay.</p>
    <form onSubmit={(event) => { event.preventDefault(); void onConfigure(clientId.trim()); }}>
      <label>Application (client) ID<input required value={clientId} maxLength={36} disabled={disabled} spellCheck={false} autoComplete="off"
        pattern="[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"
        placeholder="00000000-0000-0000-0000-000000000000" onChange={(event) => setClientId(event.target.value)} /></label>
      <button className="secondary-button" disabled={disabled} type="submit">Save application ID</button>
      {state.customApplicationId && <button className="secondary-button" disabled={disabled} type="button" onClick={() => void onConfigure('')}>Remove custom ID</button>}
    </form>
  </details>;
}

export function OneNoteNotebookPicker({ state, disabled, onRefresh, onSelect }: {
  state: OneNoteState; disabled: boolean; onRefresh(): Promise<void>; onSelect(id: string): Promise<void>;
}) {
  const missing = state.notebook && !state.notebooks.some((item) => item.id === state.notebook!.id);
  return <div className="onenote-notebook">
    <label>OneNote notebook
      <select value={state.notebook?.id ?? ''} disabled={disabled || !state.notebooks.length} onChange={(event) => void onSelect(event.target.value)}>
        <option value="" disabled>Choose a notebook…</option>
        {missing && <option value={state.notebook!.id} disabled>{state.notebook!.displayName} (unavailable)</option>}
        {state.notebooks.map((item) => <option key={item.id} value={item.id}>{item.displayName}{item.isDefault ? ' (default)' : ''}
          {state.notebooks.filter((other) => other.displayName === item.displayName).length > 1 ? ` · ${item.id.slice(-8)}` : ''}</option>)}
      </select>
    </label>
    <button className="secondary-button" disabled={disabled} onClick={() => void onRefresh()}>Refresh notebooks</button>
    <p className="preview-note">{state.notebook ? `New setups go to ${state.notebook.displayName} → TradeFrame.` : 'Choose a notebook before sending new setups to OneNote. Create or open a notebook in OneNote first if the list is empty.'}
      {' '}Changing the notebook cancels pending OneNote deliveries. Existing pages and local notes stay.</p>
  </div>;
}
