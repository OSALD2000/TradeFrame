export const FIELD_TYPES = ['text', 'textarea', 'number', 'checkbox', 'select', 'multiselect', 'date', 'datetime'] as const;
export type FieldType = typeof FIELD_TYPES[number];
export type FieldValue = string | number | boolean | string[] | null;
export type FormValues = Record<string, FieldValue>;
export type FieldOption = { value: string; label: string; tags: string[] };
export type FieldDefinition = {
  id: string; label: string; key: string; type: FieldType; required: boolean;
  tags: string[]; options?: FieldOption[]; when?: { fieldId: string; equals: FieldValue };
};
export type FormSchema = { formatVersion: 1; id: string; revision: number; name: string; fields: FieldDefinition[] };
export type SetupDocument = { schema: FormSchema; values: FormValues; createdAt: string };

const RESERVED_KEYS = new Set(['schemaVersion', 'createdAt', 'tradeframe', 'tags', 'image', '__proto__', 'constructor', 'prototype']);
const validId = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z][A-Za-z0-9_-]{0,79}$/.test(value) && !Object.hasOwn(Object.prototype, value);
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
function text(value: unknown, max: number, name: string): asserts value is string {
  check(typeof value === 'string' && value.trim().length > 0 && value.length <= max && !/[\r\n\0]/.test(value), `Invalid ${name}`);
}
function keys(value: Record<string, unknown>, allowed: string[]) {
  check(Object.keys(value).every((key) => allowed.includes(key)), 'Unknown schema property');
}
function tags(value: unknown): asserts value is string[] {
  check(Array.isArray(value) && value.length <= 30 && value.every((tag) => typeof tag === 'string'
    && tag.length <= 100 && /^[\p{L}\p{N}_][\p{L}\p{N}_/-]*$/u.test(tag))
    && new Set(value).size === value.length, 'Invalid or duplicate tags');
}

export function validateSchema(input: unknown): FormSchema {
  check(record(input), 'Invalid form schema');
  keys(input, ['formatVersion', 'id', 'revision', 'name', 'fields']);
  check(input.formatVersion === 1 && validId(input.id) && Number.isSafeInteger(input.revision)
    && (input.revision as number) > 0, 'Unsupported schema format or revision');
  text(input.name, 120, 'form name');
  check(Array.isArray(input.fields) && input.fields.length > 0 && input.fields.length <= 100, 'A form needs 1–100 fields');
  const ids = new Set<string>();
  const markdownKeys = new Set<string>();
  for (const field of input.fields) {
    check(record(field), 'Invalid field');
    keys(field, ['id', 'label', 'key', 'type', 'required', 'tags', 'options', 'when']);
    check(validId(field.id) && !ids.has(field.id), 'Invalid or duplicate field ID');
    ids.add(field.id);
    text(field.label, 120, 'field label');
    check(typeof field.key === 'string' && /^[A-Za-z][A-Za-z0-9_]{0,79}$/.test(field.key)
      && !RESERVED_KEYS.has(field.key) && !markdownKeys.has(field.key), 'Invalid, reserved or duplicate Markdown key');
    markdownKeys.add(field.key);
    check(FIELD_TYPES.includes(field.type as FieldType) && typeof field.required === 'boolean', 'Invalid field type or required flag');
    tags(field.tags);
    if (field.type === 'select' || field.type === 'multiselect') {
      check(Array.isArray(field.options) && field.options.length > 0 && field.options.length <= 100, 'Selection fields need 1–100 options');
      const optionValues = new Set<string>();
      for (const option of field.options) {
        check(record(option), 'Invalid option');
        keys(option, ['value', 'label', 'tags']);
        text(option.value, 120, 'option value');
        text(option.label, 120, 'option label');
        check(!optionValues.has(option.value), 'Duplicate option value');
        optionValues.add(option.value);
        tags(option.tags);
      }
    } else check(field.options === undefined, 'Options only belong to selection fields');
    if (field.when !== undefined) {
      check(record(field.when), 'Invalid dependency');
      keys(field.when, ['fieldId', 'equals']);
      check(validId(field.when.fieldId), 'Invalid dependency field ID');
    }
  }
  const schema = input as unknown as FormSchema;
  const visiting = new Set<string>();
  const visited = new Set<string>();
  function visit(field: FieldDefinition) {
    check(!visiting.has(field.id), 'Circular field dependency');
    if (visited.has(field.id)) return;
    visiting.add(field.id);
    if (field.when) {
      const parent = schema.fields.find((candidate) => candidate.id === field.when!.fieldId);
      check(parent && parent.type !== 'multiselect', 'Dependency must reference an existing scalar field');
      validateValue(parent, field.when.equals, false);
      visit(parent);
    }
    visiting.delete(field.id);
    visited.add(field.id);
  }
  schema.fields.forEach(visit);
  const canonical: FormSchema = { formatVersion: 1, id: schema.id, revision: schema.revision, name: schema.name,
    fields: schema.fields.map((field) => ({ id: field.id, label: field.label, key: field.key,
      type: field.type, required: field.required, tags: [...field.tags],
      ...(field.options ? { options: field.options.map((option) => ({ value: option.value, label: option.label, tags: [...option.tags] })) } : {}),
      ...(field.when ? { when: { fieldId: field.when.fieldId, equals: field.when.equals } } : {}),
    })) };
  check(new TextEncoder().encode(JSON.stringify(canonical)).byteLength <= 1_000_000, 'Form schema is too large');
  return canonical;
}

function validateValue(field: FieldDefinition, value: unknown, required = field.required): asserts value is FieldValue {
  if (value === null) {
    check(!required && field.type === 'number', `${field.label}: a value is required`);
    return;
  }
  if (field.type === 'checkbox') {
    check(typeof value === 'boolean' && (!required || value), `${field.label}: invalid checkbox value`);
  } else if (field.type === 'number') {
    check(typeof value === 'number' && Number.isFinite(value) && !Object.is(value, -0)
      && (!Number.isInteger(value) || Number.isSafeInteger(value)), `${field.label}: invalid number`);
  } else if (field.type === 'multiselect') {
    check(Array.isArray(value) && value.every((item) => typeof item === 'string' && field.options!.some((option) => option.value === item))
      && new Set(value).size === value.length && (!required || value.length > 0), `${field.label}: invalid selection`);
  } else {
    check(typeof value === 'string' && value.length <= 20000 && !value.includes('\0')
      && (!required || value.trim().length > 0), `${field.label}: invalid text`);
    if (!value && !required) return;
    if (field.type === 'select') check(field.options!.some((option) => option.value === value), `${field.label}: unknown option`);
    if (field.type === 'date' || field.type === 'datetime') {
      const isDate = field.type === 'date';
      const pattern = isDate ? /^\d{4}-\d{2}-\d{2}$/ : /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
      const date = new Date(isDate ? `${value}T00:00:00Z` : `${value}:00Z`);
      check(pattern.test(value) && Number.isFinite(date.getTime()) && date.toISOString().slice(0, isDate ? 10 : 16) === value, `${field.label}: invalid date`);
    }
  }
}

export function fieldVisible(field: FieldDefinition, schema: FormSchema, values: FormValues): boolean {
  if (!field.when) return true;
  const parent = schema.fields.find((item) => item.id === field.when!.fieldId)!;
  return fieldVisible(parent, schema, values) && Object.hasOwn(values, parent.id) && values[parent.id] === field.when.equals;
}

export function emptyValues(schema: FormSchema): FormValues {
  return Object.fromEntries(schema.fields.map((field) => [field.id,
    field.type === 'checkbox' ? false : field.type === 'number' ? null : field.type === 'multiselect' ? [] : '']));
}

export function validateValues(schema: FormSchema, input: unknown): FormValues {
  check(record(input), 'Invalid setup values');
  check(Object.keys(input).every((id) => schema.fields.some((field) => field.id === id)), 'Unknown setup field');
  const result: FormValues = {};
  for (const field of schema.fields) {
    if (!fieldVisible(field, schema, input as FormValues)) continue;
    if (!Object.hasOwn(input, field.id)) {
      check(!field.required, `${field.label}: a value is required`);
      continue;
    }
    const value = input[field.id];
    validateValue(field, value);
    result[field.id] = value;
  }
  return result;
}

export function valueTags(schema: FormSchema, values: FormValues): string[] {
  const result = new Set<string>();
  for (const field of schema.fields) {
    if (!Object.hasOwn(values, field.id)) continue;
    const value = values[field.id];
    if (value === undefined || value === null || value === '' || (Array.isArray(value) && !value.length)) continue;
    field.tags.forEach((tag) => result.add(tag));
    field.options?.filter((option) => Array.isArray(value) ? value.includes(option.value) : value === option.value)
      .forEach((option) => option.tags.forEach((tag) => result.add(tag)));
  }
  return [...result];
}

const option = (value: string, label: string): FieldOption => ({ value, label, tags: [] });
const field = (id: string, label: string, type: FieldType, required = false): FieldDefinition => ({ id, key: id, label, type, required, tags: [] });
export const DEFAULT_SCHEMA: FormSchema = {
  formatVersion: 1, id: 'default', revision: 1, name: 'Trading setup', fields: [
    { ...field('mode', 'Mode', 'select', true), options: [option('live', 'Live'), option('backtest', 'Backtest')] },
    field('symbol', 'Symbol', 'text', true),
    { ...field('direction', 'Direction', 'select', true), options: [option('long', 'Long'), option('short', 'Short')] },
    field('model', 'Model', 'text', true), field('timeframe', 'Timeframe', 'text', true),
    field('entryTimeNewYork', 'Entry time · New York', 'datetime'), field('note', 'Note', 'textarea'),
  ],
};

export function serializeSetup(document: SetupDocument): string {
  const schema = validateSchema(document.schema);
  const values = validateValues(schema, document.values);
  check(typeof document.createdAt === 'string' && Number.isFinite(Date.parse(document.createdAt))
    && new Date(document.createdAt).toISOString() === document.createdAt, 'Invalid creation timestamp');
  const exportedTags = valueTags(schema, values);
  const metadata: Record<string, unknown> = { schemaVersion: 2, createdAt: document.createdAt,
    tradeframe: { formatVersion: 1, schema }, tags: exportedTags };
  for (const field of schema.fields) if (Object.hasOwn(values, field.id)) metadata[field.key] = values[field.id];
  const notes = schema.fields.filter((field) => field.type === 'textarea' && typeof values[field.id] === 'string')
    .map((field) => `## ${field.label}\n\n${values[field.id]}\n`).join('\n');
  const markdown = `---\n${Object.entries(metadata).map(([key, value]) => `${key}: ${JSON.stringify(value)}`).join('\n')}\n---\n\n# Setup\n\n![Chart](chart.png)\n\n${exportedTags.length ? `${exportedTags.map((tag) => `#${tag}`).join(' ')}\n\n` : ''}${notes}`;
  check(new TextEncoder().encode(markdown).byteLength <= 5_000_000, 'Setup export is too large');
  return markdown;
}

export function deserializeSetup(markdown: string): SetupDocument {
  check(new TextEncoder().encode(markdown).byteLength <= 5_000_000, 'Markdown file is too large');
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(markdown);
  check(match, 'Missing TradeFrame metadata');
  const metadata: Record<string, unknown> = Object.create(null);
  for (const line of match[1].split(/\r?\n/)) {
    const item = /^([A-Za-z][A-Za-z0-9_]*): (.+)$/.exec(line);
    check(item && !Object.hasOwn(metadata, item[1]), 'Invalid or duplicate Markdown metadata');
    metadata[item[1]] = JSON.parse(item[2]);
  }
  check(typeof metadata.createdAt === 'string' && Number.isFinite(Date.parse(metadata.createdAt))
    && new Date(metadata.createdAt).toISOString() === metadata.createdAt, 'Invalid creation timestamp');
  if (metadata.schemaVersion === 1) {
    check(metadata.entryTimeZone === 'America/New_York', 'Unsupported legacy entry time zone');
    check(Object.keys(metadata).every((key) => ['schemaVersion', 'createdAt', 'entryTimeZone', ...DEFAULT_SCHEMA.fields.filter((field) => field.id !== 'note').map((field) => field.key)].includes(key)), 'Unknown legacy field');
    const values: FormValues = Object.fromEntries(DEFAULT_SCHEMA.fields.filter((field) => field.id !== 'note')
      .map((field) => [field.id, metadata[field.key] === null ? '' : metadata[field.key]])) as FormValues;
    const notes = /^\r?\n# Setup\r?\n\r?\n!\[Chart\]\(chart\.png\)\r?\n\r?\n## Notes\r?\n\r?\n([\s\S]*)$/.exec(match[2]);
    check(notes, 'Unsupported legacy notes layout');
    values.note = notes[1].replace(/\r?\n$/, '');
    return { schema: validateSchema(DEFAULT_SCHEMA), values: validateValues(DEFAULT_SCHEMA, values), createdAt: metadata.createdAt };
  }
  check(metadata.schemaVersion === 2 && record(metadata.tradeframe) && metadata.tradeframe.formatVersion === 1, 'Unsupported setup format');
  keys(metadata.tradeframe, ['formatVersion', 'schema']);
  const schema = validateSchema(metadata.tradeframe.schema);
  check(Object.keys(metadata).every((key) => ['schemaVersion', 'createdAt', 'tradeframe', 'tags', ...schema.fields.map((field) => field.key)].includes(key)), 'Unknown Markdown field');
  const values: FormValues = Object.fromEntries(schema.fields.filter((field) => Object.hasOwn(metadata, field.key))
    .map((field) => [field.id, metadata[field.key]])) as FormValues;
  const validated = validateValues(schema, values);
  check(Object.keys(validated).length === Object.keys(values).length, 'Hidden field values must not be saved');
  check(JSON.stringify(metadata.tags) === JSON.stringify(valueTags(schema, validated)), 'Markdown tags do not match the schema values');
  const document = { schema, values: validated, createdAt: metadata.createdAt };
  const canonical = serializeSetup(document);
  const body = canonical.slice(canonical.indexOf('\n---\n') + '\n---\n'.length);
  check(body.replace(/\r\n/g, '\n') === match[2].replace(/\r\n/g, '\n'), 'Markdown body does not match its field values');
  return document;
}
