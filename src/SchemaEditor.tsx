import { useState } from 'react';
import type { FormEvent } from 'react';
import { FIELD_TYPES, validateSchema } from '../electron/form-schema';
import type { FieldDefinition, FieldType, FormSchema } from '../electron/form-schema';
import { FieldInput } from './FieldInput';

export const newField = (): FieldDefinition => ({ id: `field_${crypto.randomUUID()}`, label: 'New field', key: `field_${crypto.randomUUID().slice(0, 8)}`, type: 'text', required: false, tags: [] });
const cleanTags = (tags: string[]) => tags.map((tag) => tag.trim().replace(/^#/, '')).filter(Boolean);
const typeLabels: Record<FieldType, string> = { text: 'Text', textarea: 'Long text', number: 'Number', checkbox: 'Checkbox', select: 'Single choice', multiselect: 'Multiple choice', date: 'Date', datetime: 'Date and time' };

export function SchemaEditor({ initial, busy = false, onSave, onCancel }: {
  initial: FormSchema; busy?: boolean; onSave(schema: FormSchema): Promise<void>; onCancel(): void;
}) {
  const [schema, setSchema] = useState(initial);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  function update(index: number, field: FieldDefinition) {
    setSchema((current) => ({ ...current, fields: current.fields.map((old, position) => position === index ? field : old) }));
  }
  function move(index: number, offset: number) {
    const fields = [...schema.fields];
    [fields[index], fields[index + offset]] = [fields[index + offset], fields[index]];
    setSchema({ ...schema, fields });
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    setError('');
    try {
      const validated = validateSchema({ ...schema, fields: schema.fields.map((field) => ({ ...field,
        tags: cleanTags(field.tags), ...(field.options ? { options: field.options.map((option) => ({ ...option, tags: cleanTags(option.tags) })) } : {}),
      })) });
      setSaving(true);
      await onSave(validated);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'The form could not be saved. Check its fields and retry.');
    } finally { setSaving(false); }
  }
  return <form className="schema-editor" onSubmit={save} aria-label="Form editor">
    <h3>Edit form</h3>
    <p className="preview-note">Fields keep their identity when renamed. Saving creates a new revision; earlier setups keep their original form.</p>
    <fieldset disabled={saving || busy} className="editor-body">
      <label>Form name<input value={schema.name} maxLength={120} required onChange={(event) => setSchema({ ...schema, name: event.target.value })} /></label>
      {schema.fields.map((field, index) => {
        const parent = schema.fields.find((item) => item.id === field.when?.fieldId);
        return <fieldset className="field-editor" key={field.id}>
          <legend>{index + 1}. {field.label || 'Untitled field'}</legend>
          <div className="editor-actions">
            <button type="button" className="secondary-button" disabled={index === 0} onClick={() => move(index, -1)} aria-label={`Move ${field.label} up`}>↑</button>
            <button type="button" className="secondary-button" disabled={index === schema.fields.length - 1} onClick={() => move(index, 1)} aria-label={`Move ${field.label} down`}>↓</button>
            <button type="button" className="secondary-button" onClick={() => setSchema({ ...schema, fields: schema.fields.filter((_, position) => position !== index) })}>Remove field</button>
          </div>
          <div className="editor-grid">
            <label>Label<input value={field.label} required maxLength={120} onChange={(event) => update(index, { ...field, label: event.target.value })} /></label>
            <label>Markdown key<input value={field.key} required pattern="[A-Za-z][A-Za-z0-9_]*" maxLength={80} onChange={(event) => update(index, { ...field, key: event.target.value })} /></label>
            <label>Input type<select value={field.type} onChange={(event) => {
              const type = event.target.value as FieldType;
              const { options, ...rest } = field;
              update(index, { ...rest, type, ...(['select', 'multiselect'].includes(type) ? { options: options ?? [{ value: 'option_1', label: 'Option 1', tags: [] }] } : {}) });
            }}>{FIELD_TYPES.map((type) => <option key={type} value={type}>{typeLabels[type]}</option>)}</select></label>
            <label>Tags (comma-separated)<input value={field.tags.join(',')} onChange={(event) => update(index, { ...field, tags: event.target.value.split(',') })} placeholder="e.g. trading, context" /></label>
            <label className="check-label"><input type="checkbox" checked={field.required} onChange={(event) => update(index, { ...field, required: event.target.checked })} />Required</label>
          </div>
          {field.options && <div className="option-editor">
            <h4>Options</h4>
            {field.options.map((option, optionIndex) => <div className="editor-grid" key={optionIndex}>
              {(['label', 'value', 'tags'] as const).map((key) => <label key={key}>{key === 'tags' ? 'Option tags (comma-separated)' : key === 'label' ? 'Option label' : 'Stored value'}
                <input value={key === 'tags' ? option.tags.join(',') : option[key]} required={key !== 'tags'} maxLength={key === 'tags' ? undefined : 120}
                  onChange={(event) => update(index, { ...field, options: field.options!.map((old, position) => position === optionIndex ? { ...old, [key]: key === 'tags' ? event.target.value.split(',') : event.target.value } : old) })} />
              </label>)}
              <button className="secondary-button" type="button" onClick={() => update(index, { ...field, options: field.options!.filter((_, position) => position !== optionIndex) })}>Remove option</button>
            </div>)}
            <button className="secondary-button" type="button" onClick={() => update(index, { ...field, options: [...field.options!, { label: 'New option', value: `option_${crypto.randomUUID().slice(0, 8)}`, tags: [] }] })}>Add option</button>
          </div>}
          <div className="editor-grid dependency-editor">
            <label>Show this field when<select value={field.when?.fieldId ?? ''} onChange={(event) => {
              const target = schema.fields.find((item) => item.id === event.target.value);
              const { when, ...rest } = field;
              update(index, target ? { ...rest, when: { fieldId: target.id, equals: target.type === 'checkbox' ? true : target.type === 'number' ? 0 : target.options?.[0]?.value ?? '' } } : rest);
            }}><option value="">Always visible</option>{schema.fields.filter((item) => item.id !== field.id && item.type !== 'multiselect').map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
            {field.when && parent && <label>Equals<FieldInput field={parent} required={false} value={field.when.equals} onChange={(equals) => update(index, { ...field, when: { fieldId: parent.id, equals } })} /></label>}
          </div>
        </fieldset>;
      })}
      <div className="editor-actions">
        <button type="button" className="secondary-button" onClick={() => setSchema({ ...schema, fields: [...schema.fields, newField()] })}>Add field</button>
        <button className="capture-button" type="submit">{saving ? 'Saving form…' : 'Save form revision'}</button>
        <button type="button" className="secondary-button" onClick={onCancel}>Cancel</button>
      </div>
    </fieldset>
    {error && <p role="alert" className="save-message">{error}</p>}
  </form>;
}
