import { useState } from 'react';
import type { FormEvent } from 'react';
import type { CaptureAPI, SetupInput } from '../electron/capture-types';

export function SetupForm({ api, busy, choosing }: { api: CaptureAPI | undefined; busy: boolean; choosing: boolean }) {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!api || saving || busy || choosing) return;
    const data = new FormData(event.currentTarget);
    const input = Object.fromEntries(data) as SetupInput;
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const result = await api.saveSetup(input);
      setMessage(result.status === 'saved' ? `Saved to ${result.path}` : 'Save cancelled. Your draft is unchanged.');
    } catch {
      setError('Could not save. Check your details, folder permissions and free space, then retry. Your draft and screenshot are unchanged.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="setup-form" onSubmit={save} aria-label="Setup details">
      <p>Save this screenshot and your reasoning together.</p>
      <fieldset disabled={!api || busy || saving}>
        <label>Mode<select name="mode" defaultValue="live"><option value="live">Live</option><option value="backtest">Backtest</option></select></label>
        <label>Symbol<input name="symbol" required maxLength={80} placeholder="e.g. EURUSD" /></label>
        <label>Direction<select name="direction" defaultValue="long"><option value="long">Long</option><option value="short">Short</option></select></label>
        <label>Model<input name="model" required maxLength={120} placeholder="Your setup model" /></label>
        <label>Timeframe<input name="timeframe" required maxLength={40} placeholder="e.g. 5m" /></label>
        <label>Entry time · New York (optional)<input name="entryTimeNewYork" type="datetime-local" /></label>
        <label>Note (optional)<textarea name="note" rows={5} maxLength={20000} placeholder="What made this setup interesting?" /></label>
        <button className="capture-button" type="submit" disabled={choosing}>{saving ? 'Saving…' : 'Save setup…'}</button>
      </fieldset>
      <p className="preview-note">Choose a folder when saving. Each save creates a new setup.md and chart.png in its own folder.</p>
      {message && <p className="save-message" role="status">{message}</p>}
      {error && <p className="save-message" role="alert">{error}</p>}
    </form>
  );
}
