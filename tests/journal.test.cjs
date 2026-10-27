const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const { readFileSync } = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { validateSetup, writeSetup } = require('../dist-electron/journal.js');

const input = { mode: 'live', symbol: 'EURUSD', direction: 'long', model: 'Test model',
  timeframe: '5m', entryTimeNewYork: '2026-10-27T09:30', note: 'Synthetic note\nSecond line' };
const image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';

test('setup validation rejects invalid fields and impossible dates', () => {
  assert.deepEqual(validateSetup(input), input);
  for (const invalid of [null, {}, { ...input, mode: 'paper' }, { ...input, direction: 'buy' },
    { ...input, symbol: ' ' }, { ...input, model: 'x'.repeat(121) }, { ...input, timeframe: 5 },
    { ...input, note: '\0' }, { ...input, entryTimeNewYork: '2026-02-30T09:30' },
    { ...input, entryTimeNewYork: '2026-10-27T25:00' }]) {
    assert.throws(() => validateSetup(invalid));
  }
  assert.equal(validateSetup({ ...input, entryTimeNewYork: '', note: '' }).entryTimeNewYork, '');
});

test('each save creates its own Markdown and PNG without changing existing files', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'tradeframe-save-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.writeFile(path.join(root, 'setup.md'), 'Existing journal');
  const setup = validateSetup({ ...input, symbol: '../name:\nquoted "symbol"' });
  const first = await writeSetup(root, setup, image);
  const second = await writeSetup(root, setup, image);
  assert.notEqual(first, second);
  assert.equal(path.dirname(path.dirname(first)), root);
  assert.equal(await fs.readFile(path.join(root, 'setup.md'), 'utf8'), 'Existing journal');
  const markdown = await fs.readFile(first, 'utf8');
  assert.match(markdown, /schemaVersion: 1/);
  assert.ok(markdown.includes(`symbol: ${JSON.stringify(setup.symbol)}`));
  assert.match(markdown, /entryTimeZone: "America\/New_York"/);
  assert.ok(markdown.endsWith(`${input.note}\n`));
  assert.ok(markdown.includes('![Chart](chart.png)'));
  assert.deepEqual(await fs.readFile(path.join(path.dirname(first), 'chart.png')), Buffer.from(image.split(',')[1], 'base64'));
  await assert.rejects(writeSetup(root, setup, 'data:image/png;base64,invalid'), /Invalid screenshot/);
  assert.equal((await fs.readdir(root)).length, 3);
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
    } } : require(name),
  });
  await assert.rejects(module.exports.writeSetup(root, input, image), /Synthetic disk failure/);
  assert.deepEqual(await fs.readdir(root), ['keep.md']);
  assert.equal(await fs.readFile(path.join(root, 'keep.md'), 'utf8'), 'Preserve me');
});
