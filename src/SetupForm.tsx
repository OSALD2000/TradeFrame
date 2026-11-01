import { fieldVisible } from '../electron/form-schema';
import type { SetupFormAPI } from '../electron/capture-types';
import { FieldInput } from './FieldInput';
import { SchemaEditor, newField } from './SchemaEditor';
import { OneNoteBrowser } from './OneNoteBrowser';
import { DeliveryStatus } from './DeliveryStatus';
import { SaveDestinations } from './SaveDestinations';
import { useSetupForm } from './useSetupForm';
import type { SetupFormOptions } from './useSetupForm';
import type { WorkspaceView } from './App';

export function SetupForm({
  api,
  busy,
  choosing,
  hasPreview,
  savedPath,
  timeframesReady,
  requiresTimeframeCopy,
  view,
  onOpened,
}: SetupFormOptions & {
  api: SetupFormAPI | undefined;
  savedPath: string | null;
  view: WorkspaceView;
}) {
  const {
    schema,
    values,
    editing,
    ready,
    saving,
    message,
    error,
    browsingOneNote,
    lastSaved,
    open,
    save,
    available,
    disabled,
    sendSaved,
    browseOneNote,
    newSetup,
    selectSchema,
    editSchema,
    newSchema,
    cancelEditing,
    saveSchema,
    closeOneNoteBrowser,
    openOneNoteSetup,
    changeValue,
  } = useSetupForm(
    { api, busy, choosing, hasPreview, timeframesReady, requiresTimeframeCopy, onOpened },
    newField,
  );
  return (
    <>
      <section
        id="open"
        className="open-options"
        hidden={view !== 'open'}
        aria-label="Open setup sources"
      >
        <article>
          <span className="open-source-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M3 7V5a1 1 0 0 1 1-1h6l2 2h8a1 1 0 0 1 1 1v2M3 9h18l-2 11H5z" />
            </svg>
          </span>
          <h2>On this computer</h2>
          <p>
            Choose a saved TradeFrame setup. Keep its Markdown file and screenshots in the same
            folder.
          </p>
          <button className="capture-button" type="button" disabled={disabled} onClick={open}>
            Choose a local setup…
          </button>
        </article>
        <article>
          <span className="open-source-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <rect x="5" y="3" width="15" height="18" rx="2" />
              <path d="M8 3v18m4-12v6m0-6 5 6V9M3 7h3m-3 5h3m-3 5h3" />
            </svg>
          </span>
          <h2>OneNote</h2>
          <p>Browse setups in the TradeFrame section of your selected notebook.</p>
          <button
            className="secondary-button"
            type="button"
            disabled={disabled}
            onClick={browseOneNote}
          >
            Browse OneNote setups…
          </button>
          <a href="#connections">Connect or change notebook</a>
        </article>
        <p className="preview-note">
          Your current draft stays until you choose a setup and confirm replacement. OneNote setups
          open as a separate draft; saving creates a new local copy.
        </p>
        {(editing || choosing) && (
          <p className="preview-note" role="status">
            {choosing
              ? 'Choose or cancel the pending screenshot selection'
              : 'Save or cancel your unfinished form edits'}{' '}
            in <a href="#journal">Create setup</a> before opening another setup.
          </p>
        )}
      </section>
      <div hidden={view !== 'journal'}>
        <div className="draft-tools">
          <span>{savedPath ? 'Editing a saved setup' : 'Current draft'}</span>
          <button className="secondary-button" type="button" disabled={disabled} onClick={newSetup}>
            Start a new setup
          </button>
        </div>
        <details className="form-customization">
          <summary>Customize the form (optional)</summary>
          <div className="form-controls">
            <label>
              Setup form
              <select
                disabled={disabled}
                value={`${schema.id}@${schema.revision}`}
                onChange={selectSchema}
              >
                {available.map((item) => (
                  <option key={`${item.id}@${item.revision}`} value={`${item.id}@${item.revision}`}>
                    {item.name} · v{item.revision}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="secondary-button"
              type="button"
              disabled={disabled}
              onClick={editSchema}
            >
              Edit form
            </button>
            <button
              className="secondary-button"
              type="button"
              disabled={disabled}
              onClick={newSchema}
            >
              New form
            </button>
          </div>
        </details>
        {editing ? (
          <SchemaEditor
            initial={editing}
            busy={busy}
            onCancel={cancelEditing}
            onSave={saveSchema}
          />
        ) : (
          <form
            className="setup-form"
            onSubmit={save}
            aria-label="Setup details"
            hidden={!hasPreview}
          >
            <p>Required fields help you find and understand this setup later.</p>
            <fieldset disabled={!ready || busy || saving}>
              {schema.fields
                .filter((field) => fieldVisible(field, schema, values))
                .map((field) => (
                  <label
                    key={field.id}
                    className={
                      field.type === 'textarea'
                        ? 'setup-note'
                        : field.type === 'checkbox'
                          ? 'check-label'
                          : undefined
                    }
                  >
                    {field.label}
                    {!field.required && ' (optional)'}
                    <FieldInput
                      field={field}
                      value={values[field.id]}
                      onChange={(value) => changeValue(field.id, value)}
                    />
                  </label>
                ))}
            </fieldset>
            <section className="save-section" aria-labelledby="save-title">
              <h3 id="save-title">3. Save your setup</h3>
              <SaveDestinations api={api} busy={busy} visible={view === 'journal' && hasPreview} />
              {!timeframesReady && (
                <p className="preview-note" role="status">
                  Choose a timeframe for every screenshot before saving.
                </p>
              )}
              <div className="save-actions">
                {savedPath && !requiresTimeframeCopy && (
                  <button
                    className="capture-button"
                    type="submit"
                    name="action"
                    value="append"
                    disabled={disabled || choosing || !timeframesReady}
                  >
                    {saving ? 'Saving…' : 'Append screenshots'}
                  </button>
                )}
                <button
                  className={
                    savedPath && !requiresTimeframeCopy ? 'secondary-button' : 'capture-button'
                  }
                  type="submit"
                  name="action"
                  value="copy"
                  disabled={disabled || choosing || !timeframesReady}
                >
                  {saving ? 'Saving…' : savedPath ? 'Save a separate copy' : 'Save setup'}
                </button>
                {savedPath && (
                  <button
                    className="secondary-button"
                    type="button"
                    disabled={disabled}
                    onClick={sendSaved}
                  >
                    Send saved setup to OneNote
                  </button>
                )}
              </div>
              <p className="preview-note">
                {requiresTimeframeCopy
                  ? 'This older setup has no per-image timeframes. Choose them above and save a separate copy once. The original stays unchanged.'
                  : savedPath
                    ? 'Append keeps the same file and adds new screenshots. Save a separate copy for changes to earlier details. Send saved setup uses the last saved version; save pending edits first.'
                    : 'Your journal folder is remembered. Trading journal notes use dated folders and readable names.'}
              </p>
            </section>
          </form>
        )}
        {lastSaved && <DeliveryStatus result={lastSaved} />}
      </div>
      {browsingOneNote && api && (
        <OneNoteBrowser api={api} onClose={closeOneNoteBrowser} onOpen={openOneNoteSetup} />
      )}
      {message && (
        <p className="save-message" role="status">
          {message}
        </p>
      )}
      {error && (
        <p className="save-message" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
