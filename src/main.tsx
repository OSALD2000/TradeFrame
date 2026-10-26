import { createRoot } from 'react-dom/client';
import './styles.css';

function App() {
  return (
    <div className="workspace">
      <a className="skip-link" href="#journal">Skip to journal</a>
      <aside className="sidebar" aria-label="Workspace">
        <div className="brand">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M9 3H3v6m12-6h6v6M3 15v6h6m6 0h6v-6" />
            <path d="M9 8v8m6-10v9M7 11h4m2-2h4" />
          </svg>
          <span>TradeFrame</span>
        </div>
        <nav aria-label="Main navigation">
          <a className="nav-item" href="#journal" aria-current="page">
            <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <rect x="3" y="3" width="14" height="14" rx="2" />
              <path d="M7 3v14m3-10h4m-4 3h4" />
            </svg>
            Journal
            <span className="nav-count">0</span>
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
              <button className="capture-button" disabled aria-describedby="capture-status">
                <span aria-hidden="true">＋</span> Capture chart
              </button>
            </header>
            <div className="list-header">
              <h2>All setups <span>0</span></h2>
              <span>Newest first</span>
            </div>
            <section className="empty-state" aria-labelledby="empty-title">
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
              <p className="capture-status" id="capture-status">Chart capture is coming next. No entries can be created yet.</p>
            </section>
            <footer className="journal-footer"><span>No setups yet</span><span>Capture the chart. Remember the trade.</span></footer>
          </main>
          <aside className="inspector" aria-labelledby="details-title">
            <h2 id="details-title">Setup details</h2>
            <div className="inspector-empty">
              <svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
                <rect x="6" y="4" width="20" height="24" rx="3" />
                <path d="M11 11h10m-10 5h10m-10 5h6" />
              </svg>
              <h3>The full picture</h3>
              <p>Once you have setups, select one to review its charts and notes here.</p>
            </div>
            <div className="review-sequence">
              <h3>From context to outcome</h3>
              <ol>
                <li><span className="step-dot" aria-hidden="true" /><div><strong>Context</strong><p>The bigger picture before entry.</p></div></li>
                <li><span className="step-dot" aria-hidden="true" /><div><strong>Entry</strong><p>The setup and your reasoning.</p></div></li>
                <li><span className="step-dot" aria-hidden="true" /><div><strong>Outcome</strong><p>What happened. What you learned.</p></div></li>
              </ol>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
