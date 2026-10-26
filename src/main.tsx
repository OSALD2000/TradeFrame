import { createRoot } from 'react-dom/client';
import './styles.css';

function App() {
  return (
    <div className="workspace">
      <header className="app-header">
        <a className="brand" href="#journal" aria-label="TradeFrame journal">
          <span className="brand-mark" aria-hidden="true">▣</span>
          TradeFrame
        </a>
        <span className="workspace-label">Trading journal</span>
      </header>
      <main id="journal">
        <div className="journal-heading">
          <h1>Your setups</h1>
          <span className="entry-count">0 entries</span>
        </div>
        <section className="empty-state" aria-labelledby="welcome-title">
          <svg className="frame" viewBox="0 0 240 150" fill="none" aria-hidden="true">
            <path d="M34 48V24h30m112 0h30v24M34 102v24h30m112 0h30v-24" />
            <path className="candle" d="M78 61v40m0-29v17m29-47v48m0-34v20m29-48v45m0-32v19m29-20v48m0-36v19" />
          </svg>
          <h2 id="welcome-title">Every setup has a story.</h2>
          <p>Keep the chart, your reasoning, and what happened next in one place.</p>
          <div className="development-note">
            <span className="status-dot" aria-hidden="true" />
            Chart capture is coming next. No entries can be created yet.
          </div>
          <details>
            <summary>How TradeFrame will work</summary>
            <ol>
              <li>Capture your chart with a keyboard shortcut.</li>
              <li>Add your setup, direction, and a quick note.</li>
              <li>Save locally and return later to review the trade.</li>
            </ol>
          </details>
        </section>
      </main>
      <footer>Capture the chart. Remember the trade.</footer>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
