const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateSchema, validateValues, emptyValues, fieldVisible, serializeSetup, deserializeSetup, DEFAULT_SCHEMA } = require('../dist-electron/form-schema.js');

const field = (id, type, extra = {}) => ({ id, label: id, key: id, type, required: false, tags: [], ...extra });
const schema = () => ({ formatVersion: 1, id: 'custom', revision: 1, name: 'Review 🕯', fields: [
  field('enabled', 'checkbox', { tags: ['answered'] }), field('zero', 'number'), field('missing', 'text'),
  field('empty', 'text'), field('unset', 'number'), field('notes', 'textarea', { tags: ['review/日'] }),
  field('choices', 'multiselect', { options: [{ value: 'a', label: 'Alpha', tags: ['alpha'] }, { value: 'b', label: 'Beta', tags: ['beta'] }] }),
  field('emptyList', 'multiselect', { options: [{ value: 'x', label: 'X', tags: [] }] }),
  field('date', 'date'), field('time', 'datetime'),
  field('secret', 'text', { required: true, tags: ['hidden'], when: { fieldId: 'enabled', equals: true } }),
  field('nested', 'text', { required: true, when: { fieldId: 'secret', equals: 'reveal' } }),
] });
const values = () => ({ enabled: false, zero: 0, empty: '', unset: null,
  notes: '  Größe 🕯\r\n# Heading\n```\nquotes: "yes"\n```\ntrailing  ',
  choices: ['b', 'a'], emptyList: [], date: '2024-02-29', time: '2026-10-27T09:30', secret: 'HIDDEN SECRET', nested: 'also hidden' });
const createdAt = '2026-10-27T10:00:00.000Z';

test('typed Markdown round trip preserves false zero null empty text lists whitespace and Unicode', () => {
  const form = validateSchema(schema());
  const input = values();
  const expected = { ...input };
  delete expected.secret; delete expected.nested;
  const markdown = serializeSetup({ schema: form, values: input, createdAt });
  const loaded = deserializeSetup(markdown);
  assert.deepEqual(loaded, { schema: form, values: expected, createdAt });
  assert.equal(Object.hasOwn(loaded.values, 'missing'), false);
  assert.match(markdown, /#review\/日/);
  assert.match(markdown, /#alpha/);
  assert.ok(!markdown.includes('HIDDEN SECRET'));
  assert.ok(!markdown.includes('#hidden'));
  assert.equal(input.secret, 'HIDDEN SECRET', 'The in-memory draft is not mutated');
  assert.deepEqual(deserializeSetup(markdown.replace(/(?<!\r)\n/g, '\r\n')).values, expected);
});

test('dependency chains hide descendants and apply required rules only to visible fields', () => {
  const form = validateSchema(schema());
  assert.equal(fieldVisible(form.fields.at(-1), form, values()), false);
  const active = { ...values(), enabled: true, secret: 'reveal', nested: 'visible' };
  assert.equal(validateValues(form, active).nested, 'visible');
  assert.throws(() => validateValues(form, { ...active, nested: '' }), /nested/);
  assert.equal(emptyValues(form).zero, null);
  assert.deepEqual(emptyValues(form).choices, []);
});

test('bad definitions cannot create ambiguous keys unknown options or dependency cycles', () => {
  const invalid = [];
  let form = schema(); form.fields[1].key = form.fields[0].key; invalid.push(form);
  form = schema(); form.fields[0].key = 'tradeframe'; invalid.push(form);
  form = schema(); form.fields[0].id = form.fields[1].id; invalid.push(form);
  form = schema(); form.fields[0].id = 'constructor'; invalid.push(form);
  form = schema(); form.fields[0].when = { fieldId: 'secret', equals: 'x' }; invalid.push(form);
  form = schema(); form.fields[1].when = { fieldId: 'absent', equals: 'x' }; invalid.push(form);
  form = schema(); form.fields[1].when = { fieldId: 'choices', equals: ['a'] }; invalid.push(form);
  form = schema(); form.fields[1].when = { fieldId: 'enabled', equals: 'true' }; invalid.push(form);
  form = schema(); form.fields[0].tags = ['tag with spaces']; invalid.push(form);
  form = schema(); form.fields[6].options[1].value = 'a'; invalid.push(form);
  form = schema(); form.futureFormat = true; invalid.push(form);
  for (const input of invalid) assert.throws(() => validateSchema(input));
});

test('invalid numeric date and selection values never silently change type', () => {
  const form = validateSchema(schema());
  for (const patch of [{ zero: '0' }, { zero: Infinity }, { zero: NaN }, { zero: -0 }, { zero: Number.MAX_SAFE_INTEGER + 1 },
    { enabled: 'false' }, { choices: ['unknown'] }, { choices: ['a', 'a'] }, { date: '2026-02-30' }, { time: '2026-01-01T25:00' }, { surprise: 'x' }]) {
    assert.throws(() => validateValues(form, { ...values(), ...patch }));
  }
});

test('renamed and removed fields cannot reinterpret a saved schema snapshot', () => {
  const old = validateSchema(schema());
  const markdown = serializeSetup({ schema: old, values: values(), createdAt });
  const changed = validateSchema({ ...old, revision: 2, fields: old.fields.filter((item) => item.id !== 'empty').map((item) => item.id === 'zero' ? { ...item, label: 'Renamed', key: 'new_key', type: 'text' } : item) });
  assert.equal(changed.fields[1].key, 'new_key');
  assert.equal(deserializeSetup(markdown).schema.fields[1].key, 'zero');
  assert.equal(deserializeSetup(markdown).values.zero, 0);
});

test('corrupt unsupported duplicate or contradictory Markdown is rejected', () => {
  const markdown = serializeSetup({ schema: schema(), values: values(), createdAt });
  for (const invalid of [markdown.replace('schemaVersion: 2', 'schemaVersion: 99'),
    markdown.replace('zero: 0', 'zero: "0"'), markdown.replace('zero: 0', 'zero: 0\nzero: 1'),
    markdown.replace('# Heading', '# Changed body'), markdown.replace('tags: [', 'tags: ["unexpected",'),
    markdown.replace('empty: ""', 'empty: ""\nunknown: 2')]) {
    assert.throws(() => deserializeSetup(invalid));
  }
});

test('legacy version-one files are read without rewriting their original text', () => {
  const oldValues = { mode: 'live', symbol: 'TEST', direction: 'long', model: 'Model', timeframe: '5m', entryTimeNewYork: null, entryTimeZone: 'America/New_York' };
  const markdown = `---\nschemaVersion: 1\ncreatedAt: ${JSON.stringify(createdAt)}\n${Object.entries(oldValues).map(([key, value]) => `${key}: ${JSON.stringify(value)}`).join('\n')}\n---\n\n# Setup\n\n![Chart](chart.png)\n\n## Notes\n\nOld note 🕯\n`;
  const loaded = deserializeSetup(markdown);
  assert.deepEqual(loaded.schema, validateSchema(DEFAULT_SCHEMA));
  assert.equal(loaded.values.note, 'Old note 🕯');
  assert.equal(loaded.values.entryTimeNewYork, '');
  assert.equal(deserializeSetup(serializeSetup(loaded)).values.note, 'Old note 🕯');
  assert.ok(markdown.startsWith('---\nschemaVersion: 1'));
});
