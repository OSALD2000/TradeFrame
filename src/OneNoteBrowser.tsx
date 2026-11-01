import { useEffect, useRef, useState } from 'react';
import type { CaptureAPI, OneNotePage } from '../electron/capture-types';

export function oneNoteMessage(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message.replace(/^Error invoking remote method 'onenote:(?:open|setups)': (?:Error: )?/, '') : '';
  return /^OneNote\b/.test(message) && message.length <= 600 ? message : fallback;
}
export function oneNotePageTitle(title: string) {
  return title.replace(/^TradeFrame · /, '').replace(/ · [a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i, '');
}

export function OneNoteBrowser({ api, onClose, onOpen }: {
  api: CaptureAPI; onClose(): void; onOpen(id: string): Promise<void>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [pages, setPages] = useState<OneNotePage[]>([]);
  const [notebook, setNotebook] = useState('Selected notebook');
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { dialog.current?.showModal(); }, []);
  async function refresh() {
    setLoading(true); setError('');
    try {
      const state = await api.getOneNote();
      setNotebook(state.notebook?.displayName ?? 'Choose a notebook in Connections');
      setPages(await api.listOneNoteSetups());
    } catch (error) { setError(oneNoteMessage(error, 'Could not load setups. Connect OneNote and select a notebook in Connections, then retry.')); }
    finally { setLoading(false); }
  }
  useEffect(() => { void refresh(); }, [api]);
  return <dialog ref={dialog} className="onenote-browser" aria-labelledby="onenote-open-title" onCancel={(event) => { if (opening) event.preventDefault(); else onClose(); }}>
    <div className="preview-heading"><div><h2 id="onenote-open-title">Open from OneNote</h2><p>{notebook} / TradeFrame</p></div>
      <button type="button" className="secondary-button" onClick={onClose} disabled={opening}>Close</button></div>
    <p>Open a setup as a local draft. Saving creates a new copy; the OneNote page stays unchanged.</p>
    {loading ? <p className="loading-status" role="status">{opening ? 'Opening setup… Downloading fields and screenshots.' : 'Loading OneNote…'}</p> : pages.length ? <ul className="onenote-pages">{pages.map((page) => <li key={page.id}>
      <button type="button" className="secondary-button" onClick={async () => {
        setLoading(true); setOpening(true); setError('');
        try { await onOpen(page.id); onClose(); }
        catch (error) { setError(oneNoteMessage(error, 'Could not open this setup. It may be incomplete or changed in OneNote. Your draft is unchanged. Retry its upload if screenshots are missing.')); setLoading(false); setOpening(false); }
      }}><strong>{oneNotePageTitle(page.title)}</strong><span>{page.modifiedAt && Number.isFinite(Date.parse(page.modifiedAt)) ? `Updated ${new Date(page.modifiedAt).toLocaleString()}` : 'Saved in OneNote'}</span></button>
    </li>)}</ul> : !error && <p>No TradeFrame setups found. Save and send a setup to this notebook first.</p>}
    {error && <p className="save-message" role="alert">{error} <a href="#connections" onClick={onClose}>Open Connections</a></p>}
    <button type="button" className="secondary-button" disabled={loading} onClick={() => void refresh()}>Refresh setups</button>
  </dialog>;
}
