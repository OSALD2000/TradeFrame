import { useEffect, useState } from 'react';
import type { CaptureAPI, Connections as ConnectionState, FolderKind } from '../electron/capture-types';
import { OneNoteConnection } from './OneNoteConnection';

const labels: Record<FolderKind | 'onenote', string> = { journal: 'Local journal', obsidian: 'Obsidian', dropbox: 'Dropbox', onenote: 'OneNote' };
export function Connections({ api, busy }: { api: CaptureAPI | undefined; busy: boolean }) {
  const [connections, setConnections] = useState<ConnectionState | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!api || busy) return;
    let active = true;
    api.getConnections().then((value) => { if (active) setConnections(value); })
      .catch(() => { if (active) setError('Could not load connections. Check access to the application data folder.'); });
    return () => { active = false; };
  }, [api, busy]);
  async function update(action: () => Promise<ConnectionState>) {
    setWorking(true); setError('');
    try { setConnections(await action()); }
    catch { setError('Could not update connections. Check folder access and try again.'); }
    finally { setWorking(false); }
  }
  const pending = connections?.jobs.filter((job) => job.status !== 'synced') ?? [];
  return <section className="connections" id="connections" aria-labelledby="connections-title">
    <div className="preview-heading"><div><h2 id="connections-title">Connections</h2>
      <p>Save locally, then send the same setup to every connected destination.</p></div>
      {pending.length > 0 && <button className="secondary-button" disabled={!api || busy || working} onClick={() => api && update(api.retrySync)}>Retry sync ({pending.length})</button>}
    </div>
    {(['journal', 'obsidian', 'dropbox'] as const).map((kind) => <div className="connection-row" key={kind}>
      <div><h3>{labels[kind]}</h3><p>{connections?.folders[kind] ?? (kind === 'journal' ? 'Choose once, or when you first save.' : 'Not connected')}</p>
        {kind === 'obsidian' && <p>Choose your vault. Setups go into its TradeFrame folder.</p>}
        {kind === 'dropbox' && <p>Choose a folder synced by the Dropbox desktop app. Dropbox handles cloud delivery.</p>}
      </div>
      <div className="connection-actions">
        <button className="secondary-button" disabled={!api || busy || working} onClick={() => api && update(() => api.connectFolder(kind))}>{connections?.folders[kind] ? 'Change folder…' : 'Choose folder…'}</button>
        {connections?.folders[kind] && <button className="secondary-button" disabled={!api || busy || working} onClick={() => api && update(() => api.disconnectFolder(kind))}>{kind === 'journal' ? 'Reset' : 'Disconnect'}</button>}
      </div>
    </div>)}
    <OneNoteConnection api={api} busy={busy} />
    <p className="preview-note">All three services can be connected together. Only saved setups are sent; external edits are preserved. This is one-way sync from TradeFrame.</p>
    {pending.length > 0 && <ul className="sync-jobs" aria-label="Sync requiring attention">{pending.slice(-10).map((job) => <li key={job.id}><strong>{labels[job.kind]}</strong> · {job.status === 'pending' ? 'Waiting to sync' : job.error}<br /><span>{job.source}</span></li>)}</ul>}
    {error && <p className="save-message" role="alert">{error}</p>}
  </section>;
}
