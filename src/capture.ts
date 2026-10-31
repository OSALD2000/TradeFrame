import { useEffect, useState } from 'react';
import type { CaptureAPI, CaptureState } from '../electron/capture-types';

declare global {
  interface Window { capture?: CaptureAPI }
}

export function useCapture() {
  const [state, setState] = useState<CaptureState>({ barOpen: false, busy: false, sources: [], screenshots: [], savedPath: null, requiresTimeframeCopy: false, error: null });
  const api = window.capture;
  const [actionError, setActionError] = useState<string | null>(null);
  useEffect(() => {
    if (!api) return;
    const unsubscribe = api.onStateChange(setState);
    api.getState().then(setState).catch(() => setActionError('Restart TradeFrame to reconnect the capture controls.'));
    return unsubscribe;
  }, [api]);

  async function run(action: () => Promise<unknown>) {
    setActionError(null);
    try { await action(); }
    catch { setActionError('This action could not finish. Return to the journal and try again.'); }
  }
  return { state, api, run, error: actionError || state.error };
}
