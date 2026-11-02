import { useEffect, useRef, useState } from 'react';
import type { CaptureAPI, CaptureState } from '../electron/capture-types';

declare global {
  interface Window {
    capture?: CaptureAPI;
  }
}

export function useCapture() {
  const [state, setState] = useState<CaptureState>({
    barOpen: false,
    busy: false,
    sources: [],
    areaSource: null,
    screenshots: [],
    savedPath: null,
    requiresTimeframeCopy: false,
    error: null,
  });
  const api = window.capture;
  const [actionError, setActionError] = useState<string | null>(null);
  const received = useRef(false);
  function restoreCapture(next: CaptureState) {
    received.current = true;
    setState(next);
  }
  useEffect(() => {
    if (!api) return;
    let active = true;
    received.current = false;
    const unsubscribe = api.onStateChange((next) => {
      if (active) restoreCapture(next);
    });
    api
      .getState()
      .then((next) => {
        if (active && !received.current) setState(next);
      })
      .catch(() => {
        if (active && !received.current)
          setActionError('Restart TradeFrame to reconnect the capture controls.');
      });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [api]);

  async function run(action: () => Promise<unknown>) {
    setActionError(null);
    try {
      await action();
    } catch {
      setActionError('This action could not finish. Return to the journal and try again.');
    }
  }
  return { state, api, run, restoreCapture, error: actionError || state.error };
}
