const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const { readFileSync } = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { validateSetup, writeSetup, readSetup, appendScreenshots } = require('../dist-electron/journal.js');
const { DEFAULT_SCHEMA, deserializeSetup } = require('../dist-electron/form-schema.js');

const values = { mode: 'live', symbol: 'EURUSD', direction: 'long', model: 'Test model',
  timeframe: '5m', entryTimeNewYork: '2026-10-27T09:30', note: 'Synthetic note\nSecond line' };
const input = { schema: DEFAULT_SCHEMA, values };
const image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
const screenshots = [{ id: 'test', image, caption: '', capturedAt: '2026-10-30T12:00:00.000Z' }];

test('follow-up screenshots append to the same file, preserve its original bytes and keep a backup', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'tradeframe-append-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const file = await writeSetup(root, input, screenshots);
  const original = await fs.readFile(file, 'utf8');
  const loaded = await readSetup(file);
  const more = [...loaded.screenshots, { ...screenshots[0], id: 'second', caption: '1h follow-up' }];
  const backup = await appendScreenshots(file, loaded.fingerprint, input, more);
  assert.equal(await fs.readFile(backup, 'utf8'), original);
  assert.ok((await fs.readFile(file, 'utf8')).startsWith(original));
  let reopened = await readSetup(file);
  assert.equal(reopened.screenshots.length, 2);
  assert.deepEqual(reopened.values, values);
  assert.equal(reopened.screenshots[1].caption, '1h follow-up');
  await assert.rejects(appendScreenshots(file, loaded.fingerprint, input, more), /changed/);
  await assert.rejects(appendScreenshots(file, reopened.fingerprint, { ...input, values: { ...values, note: 'Changed' } }, [...more, more[1]]), /Save copy/);
  await appendScreenshots(file, reopened.fingerprint, input, [...reopened.screenshots, { ...more[1], id: 'third', caption: 'Exit' }]);
  reopened = await readSetup(file);
  assert.equal(reopened.screenshots.length, 3);
  const complete = await fs.readFile(file, 'utf8');
  assert.equal(deserializeSetup(complete.replace(/(?<!\r)\n/g, '\r\n')).screenshots.length, 3);
  await fs.appendFile(file, '\nExternal Obsidian note\n');
  await assert.rejects(appendScreenshots(file, reopened.fingerprint, input, [...reopened.screenshots, more[1]]));
  assert.ok((await fs.readFile(file, 'utf8')).endsWith('External Obsidian note\n'));
  assert.equal((await fs.readFile(path.join(path.dirname(file), 'chart.png'))).toString('base64'), image.split(',')[1]);
});

test('multiple screenshots round trip in one Markdown file and follow-up saves preserve the original', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'tradeframe-multiple-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const shots = [screenshots[0], { ...screenshots[0], id: 'second', caption: '1h follow-up 🕯' }];
  const first = await writeSetup(root, input, shots);
  const original = await fs.readFile(first, 'utf8');
  const loaded = await readSetup(first);
  assert.deepEqual(loaded.screenshots.map(({ id, ...shot }) => shot), shots.map(({ id, ...shot }) => shot));
  assert.match(original, /!\[Chart 2\]\(chart-002.png\)/);
  assert.match(original, /1h follow-up 🕯/);
  const second = await writeSetup(root, input, [...loaded.screenshots, { ...shots[1], id: 'third', caption: 'Exit' }]);
  assert.equal((await readSetup(second)).screenshots.length, 3);
  assert.equal(await fs.readFile(first, 'utf8'), original);
  assert.deepEqual(await fs.readdir(path.dirname(first)), ['chart-002.png', 'chart.png', 'setup.md']);
  await assert.rejects(writeSetup(root, input, []), /1–20/);
  await assert.rejects(writeSetup(root, input, Array(21).fill(shots[0])), /1–20/);
  for (const file of ['../outside.png', '/tmp/chart.png', 'chart-003.png']) {
    const bad = original.replace('chart-002.png', file);
    assert.throws(() => deserializeSetup(bad), /filename/);
  }
});

test('version 2 single-image files remain readable without rewriting them', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'tradeframe-legacy-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const markdown = require('../dist-electron/form-schema.js').serializeSetup({ ...input, createdAt: screenshots[0].capturedAt });
  const file = path.join(root, 'old.md');
  await fs.writeFile(file, markdown);
  await fs.writeFile(path.join(root, 'chart.png'), Buffer.from(image.split(',')[1], 'base64'));
  const loaded = await readSetup(file);
  assert.equal(loaded.screenshots.length, 1);
  assert.equal(loaded.screenshots[0].image, image);
  assert.equal(await fs.readFile(file, 'utf8'), markdown);
});

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
  const first = await writeSetup(root, setup, screenshots);
  const second = await writeSetup(root, setup, screenshots);
  assert.notEqual(first, second);
  assert.equal(path.dirname(path.dirname(first)), root);
  assert.equal(await fs.readFile(path.join(root, 'setup.md'), 'utf8'), 'Existing journal');
  const markdown = await fs.readFile(first, 'utf8');
  assert.match(markdown, /schemaVersion: 3/);
  assert.ok(markdown.includes(`symbol: ${JSON.stringify(setup.values.symbol)}`));
  assert.deepEqual(deserializeSetup(markdown).values, setup.values);
  assert.ok(markdown.endsWith(`${values.note}\n`));
  assert.ok(markdown.includes('![Chart 1](chart.png)'));
  assert.deepEqual(await fs.readFile(path.join(path.dirname(first), 'chart.png')), Buffer.from(image.split(',')[1], 'base64'));
  await assert.rejects(writeSetup(root, setup, [{ ...screenshots[0], image: 'data:image/png;base64,invalid' }]), /Invalid screenshot/);
  assert.equal((await fs.readdir(root)).length, 3);
  const loaded = await readSetup(first);
  assert.deepEqual(loaded.values, setup.values);
  assert.equal(loaded.screenshots[0].image, image);
});

test('opening rejects symbolic-link images and missing or invalid setup files', async (t) => {
  if (process.platform === 'win32') { t.skip('Creating symbolic links requires additional Windows privileges'); return; }
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'tradeframe-read-boundary-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const file = await writeSetup(root, input, screenshots);
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
    require: (name) => name === './append-store' ? { ...require('../dist-electron/append-store.js'), createFile: async (file, ...args) => {
      if (file.endsWith('setup.md')) throw new Error('Synthetic disk failure');
      return require('../dist-electron/append-store.js').createFile(file, ...args);
    } } : require(name.startsWith('./') ? path.resolve(__dirname, '../dist-electron', name) : name),
  });
  await assert.rejects(module.exports.writeSetup(root, input, screenshots), /Synthetic disk failure/);
  assert.deepEqual(await fs.readdir(root), ['keep.md']);
  assert.equal(await fs.readFile(path.join(root, 'keep.md'), 'utf8'), 'Preserve me');
});
