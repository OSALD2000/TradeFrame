const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');
const { setTimeout: delay } = require('node:timers/promises');
const { readSetup, writeSetup, appendScreenshots } = require('../dist-electron/journal.js');
const { copySnapshot } = require('../dist-electron/connections.js');
const { DEFAULT_SCHEMA } = require('../dist-electron/form-schema.js');
const { createFile } = require('../dist-electron/append-store.js');
const image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
const input = { schema: DEFAULT_SCHEMA, values: { mode: 'live', symbol: 'TEST', direction: 'long', model: 'Synthetic', timeframe: '5m', entryTimeNewYork: '', note: 'Keep all original text 🕯' } };
const screenshot = { id: 'test', image, caption: 'Entry', capturedAt: '2026-10-30T12:00:00.000Z', timeframe: '1m' };
async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'tradeframe-recovery-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const file = await writeSetup(root, input, [screenshot]);
  const data = { file, input, screenshot: { ...screenshot, id: 'follow-up', caption: 'Follow-up 🕯' } };
  const fixtureFile = path.join(root, 'fixture.json');
  await fs.writeFile(fixtureFile, JSON.stringify(data));
  return { root, file, fixtureFile, data, original: await fs.readFile(file), lock: path.join(path.dirname(file), '.tradeframe-write.lock') };
}
function interrupt(t, scenario, f, action = 'append') {
  const child = spawn(process.execPath, [path.join(__dirname, 'helpers/interrupted-append.cjs'), scenario, f.fixtureFile, action], { stdio: ['pipe', 'pipe', 'pipe'] });
  let errors = '';
  child.stderr.on('data', (data) => { errors += data; });
  const terminal = new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code, signal) => resolve({ code, signal, errors }));
  });
  t.after(() => { if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL'); });
  return { child, terminal };
}

for (const scenario of ['prepared', 'partial', 'committed']) test(`reopening recovers an append after process exit at ${scenario} without duplicating images`, { timeout: 10000 }, async (t) => {
  const f = await fixture(t);
  const worker = interrupt(t, scenario, f);
  const ended = await worker.terminal;
  assert.equal(ended.code, 71, ended.errors);
  await fs.stat(f.lock);
  const loaded = await readSetup(f.file);
  assert.equal(loaded.screenshots.length, 2);
  assert.equal(loaded.screenshots[1].caption, 'Follow-up 🕯');
  assert.equal(loaded.values.note, input.values.note);
  assert.ok((await fs.readFile(f.file)).subarray(0, f.original.length).equals(f.original));
  assert.deepEqual(await fs.readFile(path.join(path.dirname(f.file), 'chart.png')), Buffer.from(image.split(',')[1], 'base64'));
  assert.equal((await readSetup(f.file)).fingerprint, loaded.fingerprint);
  await assert.rejects(fs.stat(f.lock), { code: 'ENOENT' });
  const names = await fs.readdir(path.dirname(f.file));
  assert.equal(names.some((name) => name.startsWith('.tradeframe-append-')), false);
  const backup = names.find((name) => name.endsWith('.bak'));
  assert.deepEqual(await fs.readFile(path.join(path.dirname(f.file), backup)), f.original);
});

test('recovery waits for a live writer and resumes only after its process has terminated', { timeout: 10000 }, async (t) => {
  const f = await fixture(t);
  const worker = interrupt(t, 'active', f);
  let prepared = false;
  for (let attempt = 0; attempt < 500; attempt++) {
    assert.equal(worker.child.exitCode, null, 'The writer must still be running');
    try { await fs.stat(f.lock); process.kill(worker.child.pid, 0); prepared = true; break; }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    await delay(10);
  }
  assert.equal(prepared, true, 'The live writer must have published its recovery record');
  await assert.rejects(readSetup(f.file), /another operation/);
  assert.deepEqual(await fs.readFile(f.file), f.original);
  worker.child.kill('SIGKILL');
  await worker.terminal;
  assert.equal((await readSetup(f.file)).screenshots.length, 2);
});

test('retrying the same append after recovery reports success without appending twice', { timeout: 10000 }, async (t) => {
  const f = await fixture(t);
  const before = await readSetup(f.file);
  assert.equal((await interrupt(t, 'partial', f).terminal).code, 71);
  const backup = await appendScreenshots(f.file, before.fingerprint, input, [...before.screenshots, f.data.screenshot]);
  assert.deepEqual(await fs.readFile(backup), f.original);
  assert.equal((await readSetup(f.file)).screenshots.length, 2);
  assert.equal((await fs.readFile(f.file, 'utf8')).split('<!-- tradeframe-screenshot: ').length, 2);
});

test('external text changes stop recovery without changing the document, images, backup or intent', { timeout: 10000 }, async (t) => {
  const f = await fixture(t);
  assert.equal((await interrupt(t, 'partial', f).terminal).code, 71);
  await fs.appendFile(f.file, '\nExternal note must survive\n');
  const modified = await fs.readFile(f.file);
  const before = await fs.readdir(path.dirname(f.file));
  await assert.rejects(readSetup(f.file), /changed outside TradeFrame/);
  assert.deepEqual(await fs.readFile(f.file), modified);
  assert.deepEqual(await fs.readdir(path.dirname(f.file)), before);
  await fs.stat(f.lock);
});

test('a changed original image stops recovery and remains untouched', { timeout: 10000 }, async (t) => {
  const f = await fixture(t);
  assert.equal((await interrupt(t, 'prepared', f).terminal).code, 71);
  const imageFile = path.join(path.dirname(f.file), 'chart.png');
  const changed = Buffer.concat([await fs.readFile(imageFile), Buffer.from('External edit')]);
  await fs.writeFile(imageFile, changed);
  await assert.rejects(readSetup(f.file), /Append image changed/);
  assert.deepEqual(await fs.readFile(imageFile), changed);
  assert.deepEqual(await fs.readFile(f.file), f.original);
  await fs.stat(f.lock);
});

test('successful cleanup removes only owned recovery files and preserves any unrelated contents', { timeout: 10000 }, async (t) => {
  const f = await fixture(t);
  assert.equal((await interrupt(t, 'prepared', f).terminal).code, 71);
  const record = JSON.parse(await fs.readFile(f.lock, 'utf8'));
  const keep = path.join(path.dirname(f.file), record.operation, 'keep.txt');
  await fs.writeFile(keep, 'Preserve me');
  assert.equal((await readSetup(f.file)).screenshots.length, 2);
  assert.equal(await fs.readFile(keep, 'utf8'), 'Preserve me');
  await assert.rejects(fs.stat(f.lock), { code: 'ENOENT' });
});

test('tampered recovery files and legacy empty locks are preserved rather than guessed', { timeout: 10000 }, async (t) => {
  const f = await fixture(t);
  assert.equal((await interrupt(t, 'prepared', f).terminal).code, 71);
  const record = JSON.parse(await fs.readFile(f.lock, 'utf8'));
  await fs.appendFile(path.join(path.dirname(f.file), record.operation, 'addition.md'), 'Changed');
  await assert.rejects(readSetup(f.file), /recovery data changed/);
  assert.deepEqual(await fs.readFile(f.file), f.original);
  await fs.writeFile(f.lock, '');
  await assert.rejects(readSetup(f.file));
  assert.equal(await fs.readFile(f.lock, 'utf8'), '');
});

test('recovery rejects paths outside its owned operation and keeps all existing files', { timeout: 10000 }, async (t) => {
  const f = await fixture(t);
  assert.equal((await interrupt(t, 'prepared', f).terminal).code, 71);
  const original = JSON.parse(await fs.readFile(f.lock, 'utf8'));
  for (const patch of [{ operation: '../outside' }, { backup: '../outside.md' },
    { images: [...original.images.slice(0, 1), { name: '../outside.png', hash: original.images[1].hash }] }]) {
    await fs.writeFile(f.lock, JSON.stringify({ ...original, ...patch }));
    await assert.rejects(readSetup(f.file), /Unrecognized/);
    assert.deepEqual(await fs.readFile(f.file), f.original);
  }
});

test('publishing a new complete file never replaces an existing destination or leaves a temporary file on failure', async (t) => {
  const f = await fixture(t);
  const target = path.join(f.root, 'existing.md');
  await fs.writeFile(target, 'Existing user content');
  await assert.rejects(createFile(target, Buffer.from('New content')), { code: 'EEXIST' });
  assert.equal(await fs.readFile(target, 'utf8'), 'Existing user content');
  assert.equal((await fs.readdir(f.root)).some((name) => name.startsWith('.tradeframe-file-')), false);
});

test('folder delivery retries recover an interrupted target append exactly once', { timeout: 10000 }, async (t) => {
  const f = await fixture(t);
  const folder = path.join(f.root, 'destination');
  await fs.mkdir(folder);
  const targetRoot = path.join(folder, 'TradeFrame');
  const target = await copySnapshot(f.file, targetRoot);
  const loaded = await readSetup(f.file);
  await appendScreenshots(f.file, loaded.fingerprint, input, [...loaded.screenshots, f.data.screenshot]);
  await fs.writeFile(f.fixtureFile, JSON.stringify({ source: f.file, target: targetRoot }));
  const ended = await interrupt(t, 'partial', f, 'copy').terminal;
  assert.equal(ended.code, 71, ended.errors);
  await copySnapshot(f.file, targetRoot);
  assert.equal((await readSetup(target)).screenshots.length, 2);
  assert.deepEqual(await fs.readFile(target), await fs.readFile(f.file));
  await copySnapshot(f.file, targetRoot);
  assert.deepEqual(await fs.readFile(target), await fs.readFile(f.file));
});
