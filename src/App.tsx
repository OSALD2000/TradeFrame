import { useEffect, useRef, useState } from 'react';
import { useCapture } from './capture';
import { SetupForm } from './SetupForm';
import { Connections } from './Connections';
import { ScreenshotFields } from './ScreenshotFields';
import { validTimeframe } from '../electron/form-schema';
import { version } from '../package.json';

export type WorkspaceView = 'journal' | 'open' | 'connections';
export function viewFromHash(hash: string): WorkspaceView | null {
  return hash === '#journal'
    ? 'journal'
    : hash === '#open'
      ? 'open'
      : hash === '#connections'
        ? 'connections'
        : null;
}
const titles = { journal: 'Create a setup', open: 'Open a setup', connections: 'Connections' };
const descriptions = {
  journal: 'Capture a chart, add your reasoning, and save it.',
  open: 'Continue from a local file or your OneNote notebook.',
  connections: 'Choose your local journal and the services that receive saved setups.',
};

export function App() {
  const { state, api, run, restoreCapture, error } = useCapture();
  const [view, setView] = useState<WorkspaceView>(
    () => viewFromHash(window.location.hash) ?? 'journal',
  );
  const main = useRef<HTMLElement>(null);
  const previousShots = useRef(state.screenshots.length);
  function navigate(next: WorkspaceView) {
    setView(next);
    window.location.hash = next;
  }
  useEffect(() => {
    const changed = () => {
      const next = viewFromHash(window.location.hash);
      if (next) setView(next);
    };
    window.addEventListener('hashchange', changed);
    return () => window.removeEventListener('hashchange', changed);
  }, []);
  useEffect(() => {
    main.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [view]);
  useEffect(() => {
    if (state.sources.length || state.screenshots.length > previousShots.current)
      navigate('journal');
    previousShots.current = state.screenshots.length;
  }, [state.sources.length, state.screenshots.length]);
  return (
    <div className="workspace">
      <a className="skip-link" href="#workspace-content">
        Skip to workspace
      </a>
      <aside className="sidebar" aria-label="Workspace">
        <div className="brand">
          <img src="./tradeframe-icon.png" alt="" width="32" height="32" />
          <span>TradeFrame</span>
        </div>
        <nav aria-label="Main navigation">
          <a
            className="nav-item"
            href="#journal"
            aria-current={view === 'journal' ? 'page' : undefined}
          >
            <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <rect x="3" y="3" width="14" height="14" rx="2" />
              <path d="M7 3v14m3-10h4m-4 3h4" />
            </svg>
            Create setup
          </a>
          <a className="nav-item" href="#open" aria-current={view === 'open' ? 'page' : undefined}>
            Open setup
          </a>
          <a
            className="nav-item"
            href="#connections"
            aria-current={view === 'connections' ? 'page' : undefined}
          >
            Connections
          </a>
        </nav>
        <div className="sidebar-bottom">
          <span className="preview-badge">Early preview</span>
          <p>Your draft stays here when you switch pages.</p>
        </div>
      </aside>

      <div className="main-area">
        <header className="toolbar">
          <span className="breadcrumb">
            Workspace <span aria-hidden="true">/</span> <strong>{titles[view]}</strong>
          </span>
          <div className="app-info">
            <span className="local-label">
              <span aria-hidden="true" />
              Local-first
            </span>
            <span className="app-version" title="TradeFrame version">
              v{version}
            </span>
          </div>
        </header>
        <div className="journal-layout">
          <main id="workspace-content" tabIndex={-1} ref={main}>
            <header className="journal-header">
              <div>
                <h1>{titles[view]}</h1>
                <p>{descriptions[view]}</p>
              </div>
              {view === 'journal' && (
                <button
                  className="secondary-button"
                  disabled={!api || state.busy}
                  onClick={() => api && run(state.barOpen ? api.showJournal : api.openBar)}
                  aria-expanded={state.barOpen}
                >
                  <span aria-hidden="true">{state.barOpen ? '×' : '＋'}</span>{' '}
                  {state.barOpen ? 'Close capture bar' : 'Capture chart'}
                </button>
              )}
            </header>
            {error && (
              <p className="capture-error" role="alert">
                {error}
              </p>
            )}
            {state.busy && (
              <p className="workspace-status" role="status">
                Working… Your draft stays available.
              </p>
            )}
            <section id="journal" hidden={view !== 'journal'} aria-label="Create setup">
              <ol className="setup-steps" aria-label="Setup workflow">
                <li>
                  <span>1</span>
                  <strong>Capture</strong>
                  <small>Keep the chart</small>
                </li>
                <li>
                  <span>2</span>
                  <strong>Describe</strong>
                  <small>Add timeframe and context</small>
                </li>
                <li>
                  <span>3</span>
                  <strong>Save &amp; send</strong>
                  <small>See every destination's result</small>
                </li>
              </ol>
              {state.sources.length > 0 ? (
                <section className="source-picker" aria-labelledby="source-title">
                  <div className="preview-heading">
                    <div>
                      <h2 id="source-title">Choose your capture</h2>
                      <p>These are snapshots from the moment you clicked Screenshot.</p>
                    </div>
                    <button className="secondary-button" onClick={() => api && run(api.discard)}>
                      Cancel selection
                    </button>
                  </div>
                  <div className="source-grid">
                    {state.sources.map((source) => (
                      <button
                        className="source-option"
                        key={source.id}
                        onClick={() => api && run(() => api.chooseSource(source.id))}
                      >
                        <img src={source.image} alt="" />
                        <span>{source.name}</span>
                      </button>
                    ))}
                  </div>
                </section>
              ) : state.screenshots.length ? (
                <section className="capture-preview" aria-labelledby="preview-title">
                  <div className="preview-heading">
                    <div>
                      <h2 id="preview-title">Setup screenshots</h2>
                      <p>
                        {state.screenshots.length} of 20 · All images will be linked in one Markdown
                        file.
                      </p>
                    </div>
                    <span className="preview-badge">In memory</span>
                  </div>
                  <div className="screenshot-list">
                    {state.screenshots.map((shot, index) => (
                      <article className="screenshot-card" key={shot.id}>
                        <div className="screenshot-heading">
                          <h3>Screenshot {index + 1}</h3>
                          <button
                            className="secondary-button"
                            disabled={state.busy}
                            aria-label={`Remove screenshot ${index + 1}`}
                            onClick={() => api && run(() => api.removeScreenshot(shot.id))}
                          >
                            Remove
                          </button>
                        </div>
                        <img
                          className="preview-image"
                          src={shot.image}
                          alt={`Chart screenshot ${index + 1}${shot.caption ? `: ${shot.caption}` : ''}`}
                        />
                        <ScreenshotFields
                          screenshot={shot}
                          busy={state.busy}
                          onTimeframe={(timeframe) =>
                            api && run(() => api.setScreenshotTimeframe(shot.id, timeframe))
                          }
                          onCaption={(caption) =>
                            api && run(() => api.captionScreenshot(shot.id, caption))
                          }
                        />
                      </article>
                    ))}
                  </div>
                  <div className="preview-actions">
                    <button
                      className="secondary-button"
                      disabled={state.busy || state.screenshots.length >= 20}
                      onClick={() => api && run(api.openBar)}
                    >
                      Add screenshot
                    </button>
                  </div>
                  <p className="preview-note">
                    {state.savedPath
                      ? `Current file: ${state.savedPath}`
                      : 'Capture more views before saving, or open a saved setup to add follow-up screenshots.'}
                  </p>
                </section>
              ) : (
                <section className="empty-state" aria-labelledby="empty-title">
                  <div className="capture-frame" aria-hidden="true">
                    <svg viewBox="0 0 168 112" fill="none">
                      <path
                        className="frame-corners"
                        d="M34 32V20h18m64 0h18v12M34 80v12h18m64 0h18V80"
                      />
                      <path className="chart-grid" d="M48 45h72M48 67h72" />
                      <path className="candles" d="M60 49v26m24-42v32m24-25v31" />
                      <path className="candle-bodies" d="M60 57v10m24-24v14m24-7v12" />
                    </svg>
                  </div>
                  <h2 id="empty-title">Start with a chart.</h2>
                  <p>
                    Capture your trading window. Then add a timeframe, your reasoning, and the
                    result.
                  </p>
                  <div className="empty-actions">
                    <button
                      className="capture-button"
                      disabled={!api || state.busy}
                      onClick={() => api && run(api.openBar)}
                    >
                      {state.barOpen ? 'Show capture bar' : 'Capture your first chart'}
                    </button>
                    <a className="secondary-button" href="#open">
                      Open an existing setup
                    </a>
                  </div>
                  <p className="capture-status" id="capture-status">
                    {api
                      ? state.barOpen
                        ? 'Click Screenshot on the floating bar, then choose the chart window if prompted.'
                        : 'The floating bar lets you take screenshots without leaving your chart.'
                      : 'Open the desktop app to capture and save setups. This browser view is a preview only.'}
                  </p>
                </section>
              )}
            </section>
            <section
              className={view === 'open' ? 'open-workspace' : 'setup-details'}
              hidden={view === 'connections' || (view === 'journal' && state.sources.length > 0)}
              aria-label={view === 'open' ? 'Open setup sources' : 'Setup details'}
            >
              {view === 'journal' && state.screenshots.length > 0 && (
                <h2 id="details-title">2. Describe your setup</h2>
              )}
              <SetupForm
                api={api}
                busy={state.busy}
                choosing={state.sources.length > 0}
                hasPreview={state.screenshots.length > 0}
                savedPath={state.savedPath}
                timeframesReady={state.screenshots.every((shot) => validTimeframe(shot.timeframe))}
                requiresTimeframeCopy={state.requiresTimeframeCopy}
                view={view}
                onOpened={(capture) => {
                  restoreCapture(capture);
                  navigate('journal');
                }}
              />
            </section>
            <div className="connections-view" hidden={view !== 'connections'}>
              <Connections api={api} busy={state.busy} />
            </div>
            <footer className="journal-footer">
              <span>Saved setups stay in your chosen folder</span>
              <span>Drafts stay in memory until saved</span>
            </footer>
          </main>
        </div>
      </div>
    </div>
  );
}
