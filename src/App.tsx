import { useEffect, useRef, useState } from 'react';
import { useCapture } from './capture';
import { SetupForm } from './SetupForm';
import { Connections } from './Connections';
import { ScreenshotFields } from './ScreenshotFields';
import { SetupGuide } from './SetupGuide';
import { AreaSelection } from './AreaSelection';
import { validTimeframe } from '../electron/form-schema';
import { version } from '../package.json';

export type WorkspaceView = 'journal' | 'open' | 'connections' | 'guide' | 'statistics';
export function viewFromHash(hash: string): WorkspaceView | null {
  return hash === '#journal'
    ? 'journal'
    : hash === '#open'
      ? 'open'
      : hash === '#connections'
        ? 'connections'
        : hash === '#guide'
          ? 'guide'
          : hash === '#statistics'
            ? 'statistics'
            : null;
}
const titles = {
  journal: 'Create a setup',
  open: 'Open a setup',
  connections: 'Connections',
  guide: 'Setup guide',
  statistics: 'Statistics',
};
const descriptions = {
  journal: 'Capture a chart, add your reasoning, and save it.',
  open: 'Continue from a local file or your OneNote notebook.',
  connections: 'Choose your local journal and the services that receive saved setups.',
  guide: 'Your first setup, filing rules and OneNote connection, step by step.',
  statistics: 'A place to review your trading journal. Coming soon.',
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
    if (
      state.sources.length ||
      state.areaSource ||
      state.screenshots.length > previousShots.current
    )
      navigate('journal');
    previousShots.current = state.screenshots.length;
  }, [state.sources.length, state.areaSource, state.screenshots.length]);
  return (
    <div className="workspace">
      {state.areaSource && api && (
        <AreaSelection
          key={state.areaSource.image}
          source={state.areaSource}
          onSelect={(rectangle) => api.selectArea(state.areaSource!.image, rectangle)}
          onCancel={() => void run(api.discard)}
        />
      )}
      <a className="skip-link" href="#workspace-content">
        Skip to workspace
      </a>
      <aside className="sidebar" aria-label="Workspace">
        <div className="brand">
          <img src="./tradeframe-icon.png" alt="" width="32" height="32" />
          <span>
            <strong>TradeFrame</strong>
            <small>Trading journal</small>
          </span>
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
            <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M3 6V4.5A1.5 1.5 0 0 1 4.5 3H8l2 2h5.5A1.5 1.5 0 0 1 17 6.5V8M3 8h14l-2 8H5z" />
            </svg>
            Open setup
          </a>
          <a
            className="nav-item"
            href="#connections"
            aria-current={view === 'connections' ? 'page' : undefined}
          >
            <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="m8 7 4 6m-4 0 4-6" />
              <rect x="2.5" y="3" width="5" height="5" rx="1.5" />
              <rect x="12.5" y="12" width="5" height="5" rx="1.5" />
            </svg>
            Connections
          </a>
          <a
            className="nav-item"
            href="#statistics"
            aria-current={view === 'statistics' ? 'page' : undefined}
          >
            <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M3 3v14h14M7 13V9m4 4V5m4 8v-3" />
            </svg>
            Statistics
          </a>
          <a
            className="nav-item"
            href="#guide"
            aria-current={view === 'guide' ? 'page' : undefined}
          >
            <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M10 5v11M3 4.5C5 3 8 3 10 5c2-2 5-2 7-.5V16c-2-1.5-5-1.5-7 0-2-1.5-5-1.5-7 0z" />
            </svg>
            Setup guide
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
                <li data-state={state.screenshots.length ? 'complete' : 'current'}>
                  <span>1</span>
                  <strong>Capture</strong>
                  <small>Keep the chart</small>
                </li>
                <li data-state={state.screenshots.length ? 'current' : 'upcoming'}>
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
                      <p>Choose the source captured when you clicked Auto chart or Select area.</p>
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
                        {source.crop === 'full' && (
                          <span>Full image · No clear chart boundary</span>
                        )}
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
                        {shot.crop === 'full' && (
                          <p className="area-help">
                            No clear chart boundary found; the full image was kept. Use Select area
                            for a precise cutout.
                          </p>
                        )}
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
                        ? 'Choose Auto chart or Select area on the floating bar, then choose the source if prompted.'
                        : 'The floating bar lets you take screenshots without leaving your chart.'
                      : 'Open the desktop app to capture and save setups. This browser view is a preview only.'}
                  </p>
                  <a className="first-use-guide" href="#guide">
                    First time here? Follow the setup guide →
                  </a>
                </section>
              )}
            </section>
            <section
              className={view === 'open' ? 'open-workspace' : 'setup-details'}
              hidden={
                (view !== 'journal' && view !== 'open') ||
                (view === 'journal' && state.sources.length > 0)
              }
              aria-label={view === 'open' ? 'Open setup sources' : 'Setup details'}
            >
              {view === 'journal' && state.screenshots.length > 0 && (
                <h2 id="details-title">2. Describe your setup</h2>
              )}
              <SetupForm
                api={api}
                busy={state.busy}
                choosing={state.sources.length > 0 || !!state.areaSource}
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
            {view === 'guide' && <SetupGuide api={api} />}
            {view === 'statistics' && (
              <section className="statistics-placeholder" aria-labelledby="statistics-title">
                <span className="preview-badge">Coming soon</span>
                <svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
                  <path d="M12 12v40h40M24 42V30m12 12V18m12 24v-8" />
                </svg>
                <h2 id="statistics-title">Your journal. A clearer perspective.</h2>
                <p>
                  Statistics are not available in this release. Keep recording your setups; this
                  area will bring performance insights into focus.
                </p>
                <a className="secondary-button" href="#journal">
                  Back to your journal
                </a>
              </section>
            )}
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
