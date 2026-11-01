import { useEffect, useState } from 'react';
import type { FilingRulesAPI, FolderKind } from '../electron/capture-types';
import {
  DEFAULT_FILING_RULES,
  FILING_FIELDS,
  FILING_EXAMPLE,
  filingPath,
  validateFilingRule,
} from '../electron/filing-rules';
import type { FilingField, FilingRule } from '../electron/filing-rules';

const labels: Record<FilingField, string> = {
  mode: 'Mode',
  year: 'Year',
  month: 'Month',
  day: 'Day',
  date: 'Market date',
  time: 'New York time',
  instrument: 'Instrument',
  session: 'Session',
  direction: 'Direction',
  model: 'Model',
};

function RuleBlocks({
  title,
  fields,
  disabled,
  onChange,
}: {
  title: string;
  fields: FilingField[];
  disabled: boolean;
  onChange(fields: FilingField[]): void;
}) {
  function move(index: number, offset: number) {
    const next = [...fields];
    [next[index], next[index + offset]] = [next[index + offset], next[index]];
    onChange(next);
  }
  return (
    <div className="rule-blocks">
      <strong>{title}</strong>
      <ol>
        {fields.map((field, index) => (
          <li key={field}>
            <span>{labels[field]}</span>
            <button
              className="secondary-button"
              type="button"
              aria-label={`Move ${title}: ${labels[field]} up`}
              disabled={disabled || index === 0}
              onClick={() => move(index, -1)}
            >
              ↑
            </button>
            <button
              className="secondary-button"
              type="button"
              aria-label={`Move ${title}: ${labels[field]} down`}
              disabled={disabled || index === fields.length - 1}
              onClick={() => move(index, 1)}
            >
              ↓
            </button>
            <button
              className="secondary-button"
              type="button"
              aria-label={`Remove ${title}: ${labels[field]}`}
              disabled={disabled}
              onClick={() => onChange(fields.filter((item) => item !== field))}
            >
              ×
            </button>
          </li>
        ))}
      </ol>
      <label>
        Add a {title.toLowerCase()} block
        <select
          value=""
          disabled={disabled || fields.length === FILING_FIELDS.length}
          onChange={(event) => {
            if (event.target.value) onChange([...fields, event.target.value as FilingField]);
          }}
        >
          <option value="">Choose a field…</option>
          {FILING_FIELDS.filter((field) => !fields.includes(field)).map((field) => (
            <option key={field} value={field}>
              {labels[field]}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

export function FilingRules({
  api,
  kind,
  busy,
}: {
  api: FilingRulesAPI | undefined;
  kind: FolderKind;
  busy: boolean;
}) {
  const [rule, setRule] = useState<FilingRule>(() => structuredClone(DEFAULT_FILING_RULES[kind]));
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    if (!api) return;
    if (typeof api.getFilingRules !== 'function' || typeof api.saveFilingRule !== 'function') {
      setError('Restart TradeFrame completely to load the filing controls for this build.');
      return;
    }
    let active = true;
    api
      .getFilingRules()
      .then((rules) => {
        if (active) {
          setRule(rules[kind]);
          setReady(true);
        }
      })
      .catch(() => {
        if (active)
          setError(
            'Could not load filing rules. Restart TradeFrame completely after an update, then check access to its data folder.',
          );
      });
    return () => {
      active = false;
    };
  }, [api, kind]);
  let preview: ReturnType<typeof filingPath> | null = null;
  let invalid = '';
  try {
    preview = filingPath(validateFilingRule(rule), FILING_EXAMPLE);
  } catch (cause) {
    invalid = (cause as Error).message;
  }
  const disabled = !api || !ready || busy || saving;
  function change(next: FilingRule) {
    setRule(next);
    setMessage('');
    setError('');
  }
  return (
    <details className="filing-rules">
      <summary>Folder structure &amp; file name</summary>
      <p>
        Applies to new Trading journal notes. Existing notes keep their saved rules, including
        follow-up screenshots. Save these rules before creating a new note.
      </p>
      <p className="preview-note">
        New notes using these rules need TradeFrame 0.7.0 or later. Existing notes are not
        converted.
      </p>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          if (!api || disabled || invalid) return;
          setSaving(true);
          setError('');
          setMessage('');
          try {
            setRule((await api.saveFilingRule(kind, rule))[kind]);
            setMessage('Rules saved for new notes. Existing files stay where they are.');
          } catch {
            setError(
              'Could not save filing rules. Check access to the application data folder and retry.',
            );
          } finally {
            setSaving(false);
          }
        }}
      >
        <fieldset disabled={disabled}>
          <label>
            Subfolder (optional)
            <input
              maxLength={80}
              value={rule.root}
              placeholder={kind === 'journal' ? 'Use the selected folder directly' : 'TradeFrame'}
              onChange={(event) => change({ ...rule, root: event.target.value })}
            />
          </label>
          <p className="preview-note">
            One folder name, without slashes. Leave it empty to use the selected destination folder
            directly.
          </p>
          <div className="filing-columns">
            <RuleBlocks
              title="Folder"
              fields={rule.folders}
              disabled={disabled}
              onChange={(folders) => change({ ...rule, folders })}
            />
            <RuleBlocks
              title="File name"
              fields={rule.name}
              disabled={disabled}
              onChange={(name) => change({ ...rule, name })}
            />
          </div>
          <label>
            File name separator
            <select
              value={rule.separator}
              onChange={(event) =>
                change({ ...rule, separator: event.target.value as FilingRule['separator'] })
              }
            >
              <option value=" ">Space</option>
              <option value=" - ">Dash</option>
              <option value="_">Underscore</option>
            </select>
          </label>
        </fieldset>
        <div className="filing-preview" aria-live="polite">
          <strong>Example · EURUSD / London / 1 November 2026</strong>
          <p>
            {preview
              ? `<selected folder>/${[...preview.segments, preview.filename].join('/')}`
              : invalid}
          </p>
          <small>
            Empty optional fields are skipped. The .md extension is added automatically. Same-name
            notes receive a number.
          </small>
        </div>
        <div className="save-actions">
          <button className="secondary-button" type="submit" disabled={disabled || !!invalid}>
            {saving ? 'Saving rules…' : 'Save rules'}
          </button>
          <button
            className="secondary-button"
            type="button"
            disabled={disabled}
            onClick={() => change(structuredClone(DEFAULT_FILING_RULES[kind]))}
          >
            Reset draft to defaults
          </button>
        </div>
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
      </form>
    </details>
  );
}
