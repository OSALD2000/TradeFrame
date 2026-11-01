import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import type { SetupFormAPI, CaptureState, SetupInput, SaveResult } from '../electron/capture-types';
import {
  JOURNAL_SCHEMA,
  emptyValues,
  fieldVisible,
  validateValues,
  journalValues,
} from '../electron/form-schema';
import type { FormSchema, FormValues } from '../electron/form-schema';
import { FieldInput } from './FieldInput';
import { SchemaEditor, newField } from './SchemaEditor';
import { OneNoteBrowser } from './OneNoteBrowser';
import { DeliveryStatus } from './DeliveryStatus';
import { SaveDestinations } from './SaveDestinations';
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
}: {
  api: SetupFormAPI | undefined;
  busy: boolean;
  choosing: boolean;
  hasPreview: boolean;
  savedPath: string | null;
  timeframesReady: boolean;
  requiresTimeframeCopy: boolean;
  view: WorkspaceView;
  onOpened(capture: CaptureState): void;
}) {
  const [schema, setSchema] = useState(JOURNAL_SCHEMA);
  const [schemas, setSchemas] = useState<FormSchema[]>([]);
  const [values, setValues] = useState<FormValues>(() => emptyValues(JOURNAL_SCHEMA));
  const [editing, setEditing] = useState<FormSchema | null>(null);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [browsingOneNote, setBrowsingOneNote] = useState(false);
  const [lastSaved, setLastSaved] = useState<SaveResult | null>(null);
  const hasValues = Object.values(values).some(
    (value) =>
      value !== '' && value !== null && value !== false && (!Array.isArray(value) || value.length),
  );
  useEffect(() => {
    if (!hasValues && !hasPreview) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = 'Keep your setup?';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [hasValues, hasPreview]);
  useEffect(() => {
    if (!api) return;
    let active = true;
    api
      .getSchemas()
      .then((list) => {
        if (!active) return;
        setSchemas(list);
        const initial = list.find((item) => item.id === JOURNAL_SCHEMA.id) ?? list[0];
        setSchema(initial);
        setValues(emptyValues(initial));
        setReady(true);
      })
      .catch(() => {
        if (active)
          setError('Could not load forms. Restart the app and check access to its data folder.');
      });
    return () => {
      active = false;
    };
  }, [api]);

  function replaceDraft(includeScreenshots = false) {
    return (
      !(hasValues || (includeScreenshots && hasPreview)) ||
      window.confirm(
        includeScreenshots
          ? 'Replace the current field values and screenshots? Saved files will stay unchanged.'
          : 'Replace your current field values? Your screenshots will stay.',
      )
    );
  }

  async function open() {
    if (!api || !replaceDraft(true)) return;
    setError('');
    setSaving(true);
    try {
      const loaded = await api.openSetup();
      if (loaded) {
        if (!loaded.capture?.screenshots.length)
          throw new Error('Restart TradeFrame to reconnect the setup controls.');
        setLastSaved(null);
        setSchema(loaded.schema);
        setValues({ ...emptyValues(loaded.schema), ...loaded.values });
        setMessage(
          'Opened setup. Capture more views to append to this file, or save a separate copy.',
        );
        onOpened(loaded.capture);
      }
    } catch {
      setError(
        'Could not open this setup. Keep its Markdown, chart PNGs and recovery files together. Check for an active writer or changes made outside TradeFrame. Your current draft is unchanged.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const append = (event.nativeEvent as SubmitEvent).submitter?.getAttribute('value') === 'append';
    if (
      !api ||
      !ready ||
      !hasPreview ||
      !timeframesReady ||
      saving ||
      busy ||
      choosing ||
      (append && requiresTimeframeCopy)
    )
      return;
    setMessage('');
    setError('');
    let input: SetupInput;
    try {
      input = { schema, values: validateValues(schema, values) };
      journalValues(schema, input.values);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Check the visible field values.');
      return;
    }
    setSaving(true);
    try {
      const result = await (append ? api.appendScreenshots(input) : api.saveSetup(input));
      if (result.status === 'cancelled') setMessage('Save cancelled. Your draft is unchanged.');
      else {
        setLastSaved(result);
      }
    } catch {
      setError(
        append
          ? 'Could not append. Keep existing fields and screenshots unchanged, capture another image, or reopen a file changed elsewhere. Backups stay beside the original. Use Save copy to change existing details.'
          : 'Could not save. Check your details, folder permissions and free space, then retry. Your draft and screenshots are unchanged.',
      );
    } finally {
      setSaving(false);
    }
  }

  const available = [
    ...schemas.filter((item) => item.id !== schema.id || item.revision !== schema.revision),
    schema,
  ];
  const disabled = !api || !ready || busy || saving || !!editing || choosing;
  async function sendSaved() {
    if (!api) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const result = await api.sendToOneNote();
      if (result.status === 'saved') setLastSaved(result);
    } catch {
      setError(
        'Could not send the saved setup. Connect OneNote, choose a notebook and check that the local file is unchanged.',
      );
    } finally {
      setSaving(false);
    }
  }
  return (
    <>
      <section
        id="open"
        className="open-options"
        hidden={view !== 'open'}
        aria-label="Open setup sources"
      >
        <article>
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
          <h2>OneNote</h2>
          <p>Browse setups in the TradeFrame section of your selected notebook.</p>
          <button
            className="secondary-button"
            type="button"
            disabled={disabled}
            onClick={() => {
              if (api && replaceDraft(true)) setBrowsingOneNote(true);
            }}
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
          <button
            className="secondary-button"
            type="button"
            disabled={disabled}
            onClick={async () => {
              if (!api || !replaceDraft(true)) return;
              try {
                await api.newSetup();
                setValues(emptyValues(schema));
                setLastSaved(null);
                setMessage('New setup ready.');
                setError('');
              } catch {
                setError(
                  'Could not start a new setup. Wait for the current operation and try again.',
                );
              }
            }}
          >
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
                onChange={(event) => {
                  const next = available.find(
                    (item) => `${item.id}@${item.revision}` === event.target.value,
                  )!;
                  if (replaceDraft()) {
                    setSchema(next);
                    setValues(emptyValues(next));
                    setMessage('');
                    setError('');
                  }
                }}
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
              onClick={() => setEditing(schema)}
            >
              Edit form
            </button>
            <button
              className="secondary-button"
              type="button"
              disabled={disabled}
              onClick={() => {
                if (replaceDraft())
                  setEditing({
                    formatVersion: 1,
                    id: `form_${crypto.randomUUID()}`,
                    revision: 1,
                    name: 'New form',
                    fields: [newField()],
                  });
              }}
            >
              New form
            </button>
          </div>
        </details>
        {editing ? (
          <SchemaEditor
            initial={editing}
            busy={busy}
            onCancel={() => setEditing(null)}
            onSave={async (draft) => {
              const saved = await api!.saveSchema(draft).catch(() => {
                throw new Error(
                  'Could not save the form. Check access to the data folder, or reload its latest revision and retry.',
                );
              });
              const next = emptyValues(saved);
              if (saved.id === schema.id)
                for (const field of saved.fields) {
                  if (
                    schema.fields.find((old) => old.id === field.id)?.type !== field.type ||
                    !Object.hasOwn(values, field.id)
                  )
                    continue;
                  const value = values[field.id];
                  if (
                    field.type === 'select' &&
                    !field.options!.some((option) => option.value === value)
                  )
                    continue;
                  next[field.id] =
                    field.type === 'multiselect' && Array.isArray(value)
                      ? value.filter((item) =>
                          field.options!.some((option) => option.value === item),
                        )
                      : value;
                }
              setSchemas((current) => [...current.filter((item) => item.id !== saved.id), saved]);
              setSchema(saved);
              setValues(next);
              setEditing(null);
              setMessage('Form revision saved.');
              setError('');
            }}
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
                      onChange={(value) =>
                        setValues((current) => ({ ...current, [field.id]: value }))
                      }
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
        <OneNoteBrowser
          api={api}
          onClose={() => setBrowsingOneNote(false)}
          onOpen={async (id) => {
            const loaded = await api.openOneNoteSetup(id);
            if (!loaded.capture?.screenshots.length)
              throw new Error(
                'OneNote could not return screenshots. Restart TradeFrame and reopen the setup.',
              );
            setLastSaved(null);
            setSchema(loaded.schema);
            setValues({ ...emptyValues(loaded.schema), ...loaded.values });
            setError('');
            setMessage(
              loaded.legacy
                ? 'Opened an older OneNote setup. Check the imported details and timeframes, then save a new local copy.'
                : 'Opened OneNote setup as a draft. Save a local copy to continue; its OneNote page stays unchanged.',
            );
            onOpened(loaded.capture);
          }}
        />
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
