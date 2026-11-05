import { useCapture } from './capture';

export function CaptureBar() {
  const { state, api, run, error } = useCapture();
  return (
    <main className="capture-bar" aria-label="TradeFrame capture controls">
      <div className="capture-bar-controls">
        <div className="bar-grip" title="Drag to move">
          <span aria-hidden="true">⠿</span> TradeFrame
        </div>
        <button
          className="capture-button"
          aria-pressed={state.autoCapture}
          disabled={
            !api ||
            (!state.autoCapture &&
              (state.busy ||
                !!state.areaSource ||
                !!state.sources.length ||
                state.screenshots.length >= 20))
          }
          onClick={() => api && run(() => api.setAutoCapture(!state.autoCapture))}
        >
          {state.autoCapture ? 'Stop Auto' : 'Auto'}
        </button>
        <button
          className="bar-return"
          disabled={!api || state.busy}
          onClick={() => api && run(api.showJournal)}
          title="Return to journal"
        >
          Journal
        </button>
        <button
          className="bar-close"
          aria-label="Close capture bar and return to journal"
          disabled={!api || state.busy}
          onClick={() => api && run(api.showJournal)}
        >
          ×
        </button>
      </div>
      <p className="bar-status" role={error ? 'alert' : 'status'}>
        {error ||
          (state.busy
            ? 'Working…'
            : `${state.screenshots.length} of 20 · ${state.screenshots.length >= 20 ? 'Limit reached · Remove an image or start a new setup' : state.autoCapture ? 'Auto on · Waiting for new clipboard images' : 'Auto off · Enable Auto, then copy a chart image'}`)}
      </p>
      {!error && (
        <p className="bar-hint">TradingView: Linux / Windows Ctrl+Shift+S · macOS Cmd+Shift+S</p>
      )}
    </main>
  );
}
