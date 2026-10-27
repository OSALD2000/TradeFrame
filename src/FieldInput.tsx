import type { FieldDefinition, FieldValue } from '../electron/form-schema';

export function FieldInput({ field, value, onChange, required = field.required }: {
  field: FieldDefinition; value: FieldValue; onChange(value: FieldValue): void; required?: boolean;
}) {
  if (field.type === 'checkbox') return <input type="checkbox" checked={value === true} required={required} onChange={(event) => onChange(event.target.checked)} />;
  if (field.type === 'textarea') return <textarea rows={5} maxLength={20000} required={required} value={typeof value === 'string' ? value : ''} onChange={(event) => onChange(event.target.value)} />;
  if (field.type === 'select' || field.type === 'multiselect') {
    const multiple = field.type === 'multiselect';
    return <select multiple={multiple} required={required} value={multiple ? (Array.isArray(value) ? value : []) : (typeof value === 'string' ? value : '')}
      onChange={(event) => onChange(multiple ? Array.from(event.target.selectedOptions, (option) => option.value) : event.target.value)}>
      {!multiple && <option value="">Choose…</option>}
      {field.options!.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>;
  }
  const type = field.type === 'datetime' ? 'datetime-local' : field.type;
  return <input type={type} required={required} maxLength={20000} step={field.type === 'number' ? 'any' : undefined}
    value={typeof value === 'string' || typeof value === 'number' ? value : ''}
    onChange={(event) => {
      if (field.type !== 'number') onChange(event.target.value);
      else {
        const number = event.target.valueAsNumber;
        onChange(Number.isNaN(number) ? null : Object.is(number, -0) ? 0 : number);
      }
    }} />;
}
