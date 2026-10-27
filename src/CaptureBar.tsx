import { useCapture } from './capture';

export function CaptureBar() {
  const { state, api, run, error } = useCapture();
  return (
    <main className="capture-bar" aria-label="TradeFrame capture controls">
      <div className="capture-bar-controls">
        <div className="bar-grip" title="Drag to move"><span aria-hidden="true">⠿</span> TradeFrame</div>
        <button className="capture-button" disabled={!api || state.busy} onClick={() => api && run(api.takeScreenshot)}>
          <span aria-hidden="true">＋</span> Screenshot
        </button>
        <button className="bar-return" disabled={!api || state.busy} onClick={() => api && run(api.showJournal)} title="Return to journal">Journal</button>
        <button className="bar-close" aria-label="Close capture bar and return to journal" disabled={!api || state.busy} onClick={() => api && run(api.showJournal)}>×</button>
      </div>
      <p className="bar-status" role={error ? 'alert' : 'status'}>{error || (state.busy ? 'Working…' : 'Capture a chart, then choose a screen or window.')}</p>
    </main>
  );
}
