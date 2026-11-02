import { DEFAULT_SAVE_DESTINATIONS, validateSaveDestinations } from '../electron/capture-types';
import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import type {
  SetupDraftAPI,
  SaveDestinations,
  CaptureState,
  SetupInput,
  SaveResult,
  UnloadAction,
} from '../electron/capture-types';
import {
  JOURNAL_SCHEMA,
  emptyValues,
  validateValues,
  journalValues,
} from '../electron/form-schema';
import type { FormSchema, FormValues, FieldDefinition, FieldValue } from '../electron/form-schema';

export type SetupFormOptions = {
  busy: boolean;
  choosing: boolean;
  hasPreview: boolean;
  timeframesReady: boolean;
  requiresTimeframeCopy: boolean;
  onOpened(capture: CaptureState): void;
};

export function useSetupForm(
  {
    api,
    busy,
    choosing,
    hasPreview,
    timeframesReady,
    requiresTimeframeCopy,
    onOpened,
  }: SetupFormOptions & { api: SetupDraftAPI | undefined },
  newField: () => FieldDefinition,
) {
  const [schema, setSchema] = useState(JOURNAL_SCHEMA);
  const [schemas, setSchemas] = useState<FormSchema[]>([]);
  const [values, setValues] = useState<FormValues>(() => emptyValues(JOURNAL_SCHEMA));
  const [editing, setEditing] = useState<FormSchema | null>(null);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [browsingOneNote, setBrowsingOneNote] = useState(false);
  const [destinations, setDestinations] = useState<SaveDestinations>({
    ...DEFAULT_SAVE_DESTINATIONS,
  });
  const [lastSaved, setLastSaved] = useState<SaveResult | null>(null);
  const [confirmation, setConfirmation] = useState<{
    message: string;
    action?: UnloadAction;
  } | null>(null);
  const pendingConfirmation = useRef<((confirmed: boolean) => void) | null>(null);
  function answerConfirmation(confirmed: boolean) {
    const resolve = pendingConfirmation.current;
    pendingConfirmation.current = null;
    setConfirmation(null);
    resolve?.(confirmed);
  }
  useEffect(() => () => pendingConfirmation.current?.(false), []);
  function requestConfirmation(message: string, action?: UnloadAction): Promise<boolean> {
    if (pendingConfirmation.current) return Promise.resolve(false);
    return new Promise((resolve) => {
      pendingConfirmation.current = resolve;
      setConfirmation({ message, action });
    });
  }
  useEffect(() => {
    if (!api?.onUnloadRequested) return;
    return api.onUnloadRequested((action) => {
      void requestConfirmation(
        'Your current fields and screenshots will be closed. Save a copy first if you need to keep them. Saved files are unchanged.',
        action,
      )
        .then((confirmed) => api.answerUnload(confirmed))
        .catch(() => {
          setError(
            'Could not close or reload. Your draft is still available; keep editing and retry.',
          );
        });
    });
  }, [api]);
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

  async function replaceDraft(includeScreenshots = false) {
    if (!(hasValues || (includeScreenshots && hasPreview))) return true;
    return requestConfirmation(
      includeScreenshots
        ? 'Replace the current field values and screenshots? Saved files will stay unchanged.'
        : 'Replace your current field values? Your screenshots will stay.',
    );
  }

  async function open() {
    if (!api || !(await replaceDraft(true))) return;
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
      validateSaveDestinations(destinations);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Check the visible field values.');
      return;
    }
    setSaving(true);
    try {
      const result = await (append
        ? api.appendScreenshots(input, destinations)
        : api.saveSetup(input, destinations));
      if (result.status === 'cancelled') setMessage('Save cancelled. Your draft is unchanged.');
      else {
        setLastSaved(result);
      }
    } catch {
      setError(
        append
          ? 'Could not append. Keep existing fields and screenshots unchanged, capture another image, or reopen a file changed elsewhere. Backups stay beside the original. Use Save copy to change existing details.'
          : 'Could not save. Check the selected destinations, connections, details and folder access, then retry. Your draft and screenshots are unchanged.',
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
        'Could not send the saved setup. Connect OneNote, choose a notebook and check that the saved setup is unchanged.',
      );
    } finally {
      setSaving(false);
    }
  }

  const browseOneNote = async () => {
    if (api && (await replaceDraft(true))) setBrowsingOneNote(true);
  };

  const newSetup = async () => {
    if (!api || !(await replaceDraft(true))) return;
    try {
      await api.newSetup();
      setValues(emptyValues(schema));
      setLastSaved(null);
      setMessage('New setup ready.');
      setError('');
    } catch {
      setError('Could not start a new setup. Wait for the current operation and try again.');
    }
  };

  const selectSchema = async (event: ChangeEvent<HTMLSelectElement>) => {
    const next = available.find((item) => `${item.id}@${item.revision}` === event.target.value)!;
    if (await replaceDraft()) {
      setSchema(next);
      setValues(emptyValues(next));
      setMessage('');
      setError('');
    }
  };

  const editSchema = () => setEditing(schema);

  const newSchema = async () => {
    if (await replaceDraft())
      setEditing({
        formatVersion: 1,
        id: `form_${crypto.randomUUID()}`,
        revision: 1,
        name: 'New form',
        fields: [newField()],
      });
  };

  const cancelEditing = () => setEditing(null);

  const saveSchema = async (draft: FormSchema) => {
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
        if (field.type === 'select' && !field.options!.some((option) => option.value === value))
          continue;
        next[field.id] =
          field.type === 'multiselect' && Array.isArray(value)
            ? value.filter((item) => field.options!.some((option) => option.value === item))
            : value;
      }
    setSchemas((current) => [...current.filter((item) => item.id !== saved.id), saved]);
    setSchema(saved);
    setValues(next);
    setEditing(null);
    setMessage('Form revision saved.');
    setError('');
  };

  const closeOneNoteBrowser = () => setBrowsingOneNote(false);

  const openOneNoteSetup = async (id: string) => {
    const loaded = await api!.openOneNoteSetup(id);
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
        ? 'Opened an older OneNote setup. Check the imported details and timeframes, then choose destinations and save a copy.'
        : 'Opened OneNote setup as a draft. Choose destinations and save to continue; its OneNote page stays unchanged.',
    );
    onOpened(loaded.capture);
  };
  const changeValue = (fieldId: string, value: FieldValue) =>
    setValues((current) => ({ ...current, [fieldId]: value }));
  return {
    schema,
    values,
    destinations,
    changeDestination: (kind: keyof SaveDestinations, checked: boolean) =>
      setDestinations((current) => ({ ...current, [kind]: checked })),
    editing,
    ready,
    saving,
    message,
    error,
    browsingOneNote,
    lastSaved,
    confirmation,
    answerConfirmation,
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
  };
}
