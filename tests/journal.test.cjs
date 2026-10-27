const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const { readFileSync } = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { validateSetup, writeSetup, readSetup } = require('../dist-electron/journal.js');
const { DEFAULT_SCHEMA, deserializeSetup } = require('../dist-electron/form-schema.js');

const values = { mode: 'live', symbol: 'EURUSD', direction: 'long', model: 'Test model',
  timeframe: '5m', entryTimeNewYork: '2026-10-27T09:30', note: 'Synthetic note\nSecond line' };
const input = { schema: DEFAULT_SCHEMA, values };
const image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';

test('setup validation rejects invalid fields and impossible dates', () => {
  assert.deepEqual(validateSetup(input).values, values);
  for (const invalid of [null, {}, ...[{ mode: 'paper' }, { direction: 'buy' },
    { symbol: ' ' }, { model: 'x'.repeat(20001) }, { timeframe: 5 },
    { note: '\0' }, { entryTimeNewYork: '2026-02-30T09:30' },
    { entryTimeNewYork: '2026-10-27T25:00' }].map((patch) => ({ schema: DEFAULT_SCHEMA, values: { ...values, ...patch } }))]) {
    assert.throws(() => validateSetup(invalid));
  }
  assert.equal(validateSetup({ schema: DEFAULT_SCHEMA, values: { ...values, entryTimeNewYork: '', note: '' } }).values.entryTimeNewYork, '');
});

test('each save creates its own Markdown and PNG without changing existing files', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'tradeframe-save-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.writeFile(path.join(root, 'setup.md'), 'Existing journal');
  const setup = validateSetup({ schema: DEFAULT_SCHEMA, values: { ...values, symbol: '../name:\nquoted "symbol"' } });
  const first = await writeSetup(root, setup, image);
  const second = await writeSetup(root, setup, image);
  assert.notEqual(first, second);
  assert.equal(path.dirname(path.dirname(first)), root);
  assert.equal(await fs.readFile(path.join(root, 'setup.md'), 'utf8'), 'Existing journal');
  const markdown = await fs.readFile(first, 'utf8');
  assert.match(markdown, /schemaVersion: 2/);
  assert.ok(markdown.includes(`symbol: ${JSON.stringify(setup.values.symbol)}`));
  assert.deepEqual(deserializeSetup(markdown).values, setup.values);
  assert.ok(markdown.endsWith(`${values.note}\n`));
  assert.ok(markdown.includes('![Chart](chart.png)'));
  assert.deepEqual(await fs.readFile(path.join(path.dirname(first), 'chart.png')), Buffer.from(image.split(',')[1], 'base64'));
  await assert.rejects(writeSetup(root, setup, 'data:image/png;base64,invalid'), /Invalid screenshot/);
  assert.equal((await fs.readdir(root)).length, 3);
  const loaded = await readSetup(first);
  assert.deepEqual(loaded.values, setup.values);
  assert.equal(loaded.image, image);
});

test('opening rejects symbolic-link images and missing or invalid setup files', async (t) => {
  if (process.platform === 'win32') { t.skip('Creating symbolic links requires additional Windows privileges'); return; }
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'tradeframe-read-boundary-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const file = await writeSetup(root, input, image);
  const imageFile = path.join(path.dirname(file), 'chart.png');
  await fs.rename(imageFile, path.join(root, 'other.png'));
  await fs.symlink(path.join(root, 'other.png'), imageFile);
  await assert.rejects(readSetup(file), /Invalid setup file or image/);
  await fs.unlink(imageFile);
  await assert.rejects(readSetup(file));
  assert.equal(await fs.readFile(path.join(root, 'other.png'), 'base64'), image.split(',')[1]);
});

test('failed Markdown writes clean up the new image without touching prior journal files', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'tradeframe-failure-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.writeFile(path.join(root, 'keep.md'), 'Preserve me');
  const module = { exports: {} };
  vm.runInNewContext(readFileSync(path.resolve(__dirname, '../dist-electron/journal.js'), 'utf8'), {
    exports: module.exports, Buffer,
    require: (name) => name === 'node:fs/promises' ? { ...fs, writeFile: async (file, ...args) => {
      if (file.endsWith('setup.md')) throw new Error('Synthetic disk failure');
      return fs.writeFile(file, ...args);
    } } : require(name.startsWith('./') ? path.resolve(__dirname, '../dist-electron', name) : name),
  });
  await assert.rejects(module.exports.writeSetup(root, input, image), /Synthetic disk failure/);
  assert.deepEqual(await fs.readdir(root), ['keep.md']);
  assert.equal(await fs.readFile(path.join(root, 'keep.md'), 'utf8'), 'Preserve me');
});
