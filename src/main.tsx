import { createRoot } from 'react-dom/client';
import './styles.css';
import { useCapture } from './capture';
import { CaptureBar } from './CaptureBar';
import { SetupForm } from './SetupForm';

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
              <button className={state.preview ? 'secondary-button' : 'capture-button'} disabled={!api || state.busy} onClick={() => api && run(state.barOpen ? api.showJournal : api.openBar)} aria-expanded={state.barOpen} aria-describedby={!state.preview && !state.sources.length ? "capture-status" : undefined}>
                <span aria-hidden="true">{state.barOpen ? '×' : '＋'}</span> {state.barOpen ? 'Close capture bar' : 'Capture chart'}
              </button>
            </header>
            <div className="list-header">
              <h2>Current capture</h2>
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
            ) : state.preview ? (
              <section className="capture-preview" aria-labelledby="preview-title">
                <div className="preview-heading"><div><h2 id="preview-title">Screenshot preview</h2><p>{state.preview.name}</p></div><span className="preview-badge">In memory</span></div>
                <img className="preview-image" src={state.preview.image} alt={`Captured chart from ${state.preview.name}`} />
                <div className="preview-actions">
                  <button className="secondary-button" disabled={state.busy} onClick={() => api && run(api.openBar)}>Retake screenshot</button>
                  <button className="secondary-button" disabled={state.busy} onClick={() => api && run(api.discard)}>Discard</button>
                </div>
                <p className="preview-note">Add setup details to save a separate local copy. Unsaved drafts are lost when you close the app.</p>
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
              <SetupForm api={api} busy={state.busy} choosing={state.sources.length > 0} hasPreview={!!state.preview} />
            </section>
            <footer className="journal-footer"><span>Saved setups stay in your chosen folder</span><span>Capture the chart. Remember the trade.</span></footer>
          </main>
        </div>
      </div>
    </div>
  );
}

const isCaptureBar = new URLSearchParams(window.location.search).get('view') === 'capture';
createRoot(document.getElementById('root')!).render(isCaptureBar ? <CaptureBar /> : <App />);
