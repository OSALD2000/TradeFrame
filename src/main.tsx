import { createRoot } from 'react-dom/client';
import './styles.css';
import { useCapture } from './capture';
import { CaptureBar } from './CaptureBar';
import { SetupForm } from './SetupForm';
import { Connections } from './Connections';

function App() {
  const { state, api, run, error } = useCapture();
  return (
    <div className="workspace">
      <a className="skip-link" href="#journal">Skip to journal</a>
      <aside className="sidebar" aria-label="Workspace">
        <div className="brand">
          <img src="./tradeframe-icon.png" alt="" width="28" height="28" />
          <span>TradeFrame</span>
        </div>
        <nav aria-label="Main navigation">
          <a className="nav-item" href="#journal" aria-current="page">
            <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <rect x="3" y="3" width="14" height="14" rx="2" />
              <path d="M7 3v14m3-10h4m-4 3h4" />
            </svg>
            Journal
          </a>
          <a className="nav-item" href="#connections">Connections</a>
        </nav>
        <div className="sidebar-bottom">
          <span className="preview-badge">Early preview</span>
          <p>Your trades. Your perspective.</p>
        </div>
      </aside>

      <div className="main-area">
        <header className="toolbar">
          <span className="breadcrumb">Workspace <span aria-hidden="true">/</span> <strong>Journal</strong></span>
          <span className="local-label"><span aria-hidden="true" />Local-first</span>
        </header>
        <div className="journal-layout">
          <main id="journal" tabIndex={-1}>
            <header className="journal-header">
              <div>
                <h1>Trading journal</h1>
                <p>A clear view of every decision.</p>
              </div>
              <button className={state.screenshots.length ? 'secondary-button' : 'capture-button'} disabled={!api || state.busy} onClick={() => api && run(state.barOpen ? api.showJournal : api.openBar)} aria-expanded={state.barOpen} aria-describedby={!state.screenshots.length && !state.sources.length ? "capture-status" : undefined}>
                <span aria-hidden="true">{state.barOpen ? '×' : '＋'}</span> {state.barOpen ? 'Close capture bar' : 'Capture chart'}
              </button>
            </header>
            <div className="list-header">
              <h2>Current setup</h2>
              <span>Local workspace</span>
            </div>
            {error && <p className="capture-error" role="alert">{error}</p>}
            {state.sources.length > 0 ? (
              <section className="source-picker" aria-labelledby="source-title">
                <div className="preview-heading"><div><h2 id="source-title">Choose your capture</h2><p>These are snapshots from the moment you clicked Screenshot.</p></div>
                  <button className="secondary-button" onClick={() => api && run(api.discard)}>Cancel selection</button>
                </div>
                <div className="source-grid">{state.sources.map((source) => (
                  <button className="source-option" key={source.id} onClick={() => api && run(() => api.chooseSource(source.id))}>
                    <img src={source.image} alt="" /><span>{source.name}</span>
                  </button>
                ))}</div>
              </section>
            ) : state.screenshots.length ? (
              <section className="capture-preview" aria-labelledby="preview-title">
                <div className="preview-heading"><div><h2 id="preview-title">Setup screenshots</h2><p>{state.screenshots.length} of 20 · All images will be linked in one Markdown file.</p></div><span className="preview-badge">In memory</span></div>
                <div className="screenshot-list">{state.screenshots.map((shot, index) => <article className="screenshot-card" key={shot.id}>
                  <div className="screenshot-heading"><h3>Screenshot {index + 1}</h3>
                    <button className="secondary-button" disabled={state.busy} aria-label={`Remove screenshot ${index + 1}`} onClick={() => api && run(() => api.removeScreenshot(shot.id))}>Remove</button>
                  </div>
                  <img className="preview-image" src={shot.image} alt={`Chart screenshot ${index + 1}${shot.caption ? `: ${shot.caption}` : ''}`} />
                  <label className="screenshot-caption">Caption (optional)
                    <input maxLength={200} disabled={state.busy} value={shot.caption} placeholder="For example, 15m entry or 1h follow-up…" onChange={(event) => api && run(() => api.captionScreenshot(shot.id, event.target.value))} />
                  </label>
                </article>)}</div>
                <div className="preview-actions">
                  <button className="secondary-button" disabled={state.busy || state.screenshots.length >= 20} onClick={() => api && run(api.openBar)}>Add screenshot</button>
                </div>
                <p className="preview-note">{state.savedPath ? `Current file: ${state.savedPath}` : 'Capture more views before saving, or open a saved setup to add follow-up screenshots.'}</p>
              </section>
            ) : <section className="empty-state" aria-labelledby="empty-title">
              <div className="capture-frame" aria-hidden="true">
                <svg viewBox="0 0 168 112" fill="none">
                  <path className="frame-corners" d="M34 32V20h18m64 0h18v12M34 80v12h18m64 0h18V80" />
                  <path className="chart-grid" d="M48 45h72M48 67h72" />
                  <path className="candles" d="M60 49v26m24-42v32m24-25v31" />
                  <path className="candle-bodies" d="M60 57v10m24-24v14m24-7v12" />
                </svg>
              </div>
              <h2 id="empty-title">Your next setup starts here.</h2>
              <p>Keep the chart, the reasoning, and the outcome together.<br className="desktop-break" /> Build a record you can learn from.</p>
              <p className="capture-status" id="capture-status">{api ? 'Capture a chart, add setup details, then save to your journal folder.' : 'Open the desktop app to capture and save setups. This browser view is a preview only.'}</p>
            </section>}
            <section className="setup-details" hidden={state.sources.length > 0} aria-labelledby="details-title">
              <h2 id="details-title">Setup details</h2>
              <SetupForm api={api} busy={state.busy} choosing={state.sources.length > 0} hasPreview={state.screenshots.length > 0} savedPath={state.savedPath} />
            </section>
            <Connections api={api} busy={state.busy} />
            <footer className="journal-footer"><span>Saved setups stay in your chosen folder</span><span>Capture the chart. Remember the trade.</span></footer>
          </main>
        </div>
      </div>
    </div>
  );
}

const isCaptureBar = new URLSearchParams(window.location.search).get('view') === 'capture';
createRoot(document.getElementById('root')!).render(isCaptureBar ? <CaptureBar /> : <App />);
