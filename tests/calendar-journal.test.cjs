const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { writeSetup, readSetup, appendScreenshots, validateSetup } = require('../dist-electron/journal.js');
const { JOURNAL_SCHEMA, DEFAULT_SCHEMA, serializeSetup, deserializeSetup } = require('../dist-electron/form-schema.js');
const { ConnectionStore } = require('../dist-electron/connections.js');
const image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
const shot = { id: 'test', image, timeframe: '1m', caption: 'Synthetic explanation\n\nSecond paragraph 🕯', capturedAt: '2026-01-02T12:00:00.000Z' };
const input = { schema: JOURNAL_SCHEMA, values: { mode: 'backtest', date: '2025-01-07', time_ny: '09:34', session: 'NY AM',
  symbol: 'TEST!', direction: 'short', model: 'Example', d_bias: '', result: 'win', r: 2, note: 'Synthetic summary' } };
async function fixture(t) {
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'tradeframe-calendar-')));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  return root;
}

test('market date controls readable day paths, metadata, per-image paragraphs and collision-safe copies', async (t) => {
  const root = await fixture(t);
  const file = await writeSetup(root, input, [shot, { ...shot, id: 'second', timeframe: '2m' }]);
  const relative = path.relative(root, file).split(path.sep).join('/');
  assert.equal(relative, 'backtesting/2025/01/07/2025-01-07 0934 TEST! Short Example.md');
  const markdown = await fs.readFile(file, 'utf8');
  const document = deserializeSetup(markdown);
  assert.equal(document.schemaVersion, 5);
  assert.deepEqual(document.values, input.values);
  assert.match(markdown, /instrument: "TEST!"/);
  assert.match(markdown, /captured: "2026-01-02"/);
  assert.match(markdown, /session: "NY AM"/);
  assert.match(markdown, /result: "win"/);
  assert.match(markdown, /r: 2/);
  assert.match(markdown, /cssclasses: \["journal","dir-short","result-win"\]/);
  assert.match(markdown, /#journal\/backtest/);
  assert.doesNotMatch(markdown, /#journal\/live/);
  assert.ok(markdown.indexOf(shot.caption) < markdown.indexOf('![Chart 1]'));
  assert.equal((await readSetup(file)).screenshots[0].caption, shot.caption);
  const copy = await writeSetup(root, input, [shot]);
  assert.equal(path.basename(copy), '2025-01-07 0934 TEST! Short Example (2).md');
  assert.notEqual(deserializeSetup(await fs.readFile(copy, 'utf8')).screenshots[0].file, document.screenshots[0].file);
  assert.equal(await fs.readFile(file, 'utf8'), markdown);
  assert.equal(serializeSetup(document), markdown);
  assert.throws(() => deserializeSetup(markdown.replace('"result-win"', '"result-loss"')), /presentation/);
  assert.throws(() => deserializeSetup(markdown.replace(document.journalId, '../outside')), /filename|identity/);
});

test('No Trade, pending and explicit zero remain distinct and invalid calendar data never creates files', async (t) => {
  const root = await fixture(t);
  for (const patch of [{ date: '' }, { date: '2025-02-30' }, { time_ny: '25:00' }, { symbol: 'line\nbreak' },
    { direction: 'notrade' }, { direction: 'notrade', result: 'notrade', r: 0 }]) {
    await assert.rejects(writeSetup(root, { ...input, values: { ...input.values, ...patch } }, [shot]));
  }
  assert.deepEqual(await fs.readdir(root), []);
  const noTrade = await writeSetup(root, { ...input, values: { ...input.values, time_ny: '', direction: 'notrade', result: 'notrade', r: null } }, [shot]);
  assert.equal(path.basename(noTrade), '2025-01-07 TEST! No Trade Example.md');
  assert.equal((await readSetup(noTrade)).values.r, null);
  const zero = await writeSetup(root, { ...input, values: { ...input.values, mode: 'live', result: 'breakeven', r: 0 } }, [shot]);
  assert.ok(path.relative(root, zero).startsWith('live'+path.sep));
  assert.equal((await readSetup(zero)).values.r, 0);
  const sanitized = await writeSetup(root, { ...input, values: { ...input.values, symbol: '../TEST:*?', model: 'A/B\\C' } }, [shot]);
  assert.equal(path.dirname(sanitized), path.dirname(noTrade));
  assert.doesNotMatch(path.basename(sanitized), /[<>:"/\\|?*]/);
});

test('calendar output refuses a redirected year folder without writing outside the journal', async (t) => {
  const root = await fixture(t);
  const outside = path.join(root, 'outside');
  await fs.mkdir(outside);
  await fs.mkdir(path.join(root, 'backtesting'));
  await fs.symlink(outside, path.join(root, 'backtesting', '2025'), process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(writeSetup(root, input, [shot]), /Invalid sync or journal folder/);
  assert.deepEqual(await fs.readdir(outside), []);
});

test('long follow-up notes preserve prior bytes and other notes in the same day', async (t) => {
  const root = await fixture(t);
  const file = await writeSetup(root, input, [shot]);
  const other = await writeSetup(root, input, [shot]);
  const untouched = await fs.readFile(other);
  const original = await fs.readFile(file);
  const loaded = await readSetup(file);
  const caption = 'Follow-up\n' + 'A'.repeat(500);
  const backup = await appendScreenshots(file, loaded.fingerprint, input, [...loaded.screenshots, { ...shot, id: 'follow', timeframe: '4h', caption }]);
  assert.deepEqual(await fs.readFile(backup), original);
  assert.ok((await fs.readFile(file)).subarray(0, original.length).equals(original));
  assert.equal((await readSetup(file)).screenshots[1].caption, caption);
  assert.deepEqual(await fs.readFile(other), untouched);
  assert.equal((await fs.readdir(path.dirname(file))).some((name) => name.endsWith('.tradeframe-write.lock')), false);
});

test('a failed new note removes only its own images from an existing day', async (t) => {
  const root = await fixture(t);
  const file = await writeSetup(root, input, [shot]);
  const original = await fs.readFile(file);
  const before = await fs.readdir(path.dirname(file));
  const module = { exports: {} };
  const dirname = path.resolve(__dirname, '../dist-electron');
  require('node:vm').runInNewContext(require('node:fs').readFileSync(path.join(dirname, 'journal.js'), 'utf8'), {
    exports: module.exports, Buffer,
    require: (name) => name === './append-store' ? { ...require('../dist-electron/append-store.js'),
      createFile: async (target, bytes) => {
        if (target.endsWith('.md')) throw new Error('Synthetic disk failure');
        return require('../dist-electron/append-store.js').createFile(target, bytes);
      } } : require(name.startsWith('./') ? path.join(dirname, name) : name),
  });
  await assert.rejects(module.exports.writeSetup(root, input, [shot]), /Synthetic disk failure/);
  assert.deepEqual(await fs.readdir(path.dirname(file)), before);
  assert.deepEqual(await fs.readFile(file), original);
});

test('both folder destinations preserve day hierarchy, multiple same-day notes and follow-ups', async (t) => {
  const root = await fixture(t);
  const targets = [path.join(root, 'obsidian'), path.join(root, 'dropbox')];
  for (const folder of targets) await fs.mkdir(folder);
  const store = new ConnectionStore(path.join(root, 'connections.json'));
  store.setFolder('obsidian', targets[0]); store.setFolder('dropbox', targets[1]);
  const first = await writeSetup(root, input, [shot]);
  const second = await writeSetup(root, input, [shot]);
  for (const file of [first, second]) { store.enqueue(file); assert.ok((await store.retry()).every((job) => job.status === 'synced')); }
  const loaded = await readSetup(first);
  await appendScreenshots(first, loaded.fingerprint, input, [...loaded.screenshots, { ...shot, id: 'follow', timeframe: '2m' }]);
  store.enqueue(first); assert.ok((await store.retry()).every((job) => job.status === 'synced'));
  for (const folder of targets) for (const file of [first, second]) {
    const target = path.join(folder, 'TradeFrame', path.relative(root, file));
    assert.deepEqual(await fs.readFile(target), await fs.readFile(file));
    assert.deepEqual((await readSetup(target)).screenshots, (await readSetup(file)).screenshots);
  }
  const conflict = path.join(targets[0], 'TradeFrame', path.relative(root, first));
  await fs.appendFile(conflict, '\nExternal text');
  store.enqueue(first);
  const jobs = await store.retry();
  assert.equal(jobs.find((job) => job.kind === 'obsidian').status, 'failed');
  assert.equal(jobs.find((job) => job.kind === 'dropbox').status, 'synced');
  assert.ok((await fs.readFile(conflict, 'utf8')).endsWith('External text'));
});

test('old version 4 files keep their original rendering and append rules', async (t) => {
  const root = await fixture(t);
  const legacy = { schema: DEFAULT_SCHEMA, values: { mode: 'live', symbol: 'TEST', direction: 'long', model: 'Example', timeframe: '5m', entryTimeNewYork: '', note: '' } };
  validateSetup(legacy);
  const file = path.join(root, 'setup.md');
  const markdown = serializeSetup({ ...legacy, schemaVersion: 4, createdAt: shot.capturedAt,
    screenshots: [{ file: 'chart.png', timeframe: '1m', caption: 'Short caption', capturedAt: shot.capturedAt }] });
  await fs.writeFile(file, markdown); await fs.writeFile(path.join(root, 'chart.png'), Buffer.from(image.split(',')[1], 'base64'));
  const loaded = await readSetup(file);
  await assert.rejects(appendScreenshots(file, loaded.fingerprint, legacy, [...loaded.screenshots, shot]), /caption/);
  await appendScreenshots(file, loaded.fingerprint, legacy, [...loaded.screenshots, { ...shot, caption: 'Follow-up' }]);
  assert.ok((await fs.readFile(file, 'utf8')).startsWith(markdown));
  assert.equal(deserializeSetup(await fs.readFile(file, 'utf8')).schemaVersion, 4);
});
