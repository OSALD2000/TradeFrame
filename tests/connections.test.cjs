const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { ConnectionStore, copySnapshot } = require('../dist-electron/connections.js');
const { writeSetup, readSetup, appendScreenshots } = require('../dist-electron/journal.js');
const { DEFAULT_SCHEMA } = require('../dist-electron/form-schema.js');
const image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
const input = { schema: DEFAULT_SCHEMA, values: { mode: 'live', symbol: 'TEST', direction: 'long', model: 'Test', timeframe: '5m', entryTimeNewYork: '', note: 'Synthetic' } };
const screenshots = [1, 2].map((i) => ({ id: String(i), image, caption: `View ${i}`, capturedAt: '2026-10-30T12:00:00.000Z', timeframe: '1m' }));
async function fixture(t) {
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'tradeframe-connections-')));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const [journal, obsidian, dropbox] = ['journal', 'obsidian', 'dropbox'].map((name) => path.join(root, name));
  for (const folder of [journal, obsidian, dropbox]) await fs.mkdir(folder);
  const config = path.join(root, 'data', 'connections.json');
  return { root, journal, obsidian, dropbox, config, file: await writeSetup(journal, input, screenshots) };
}
test('Obsidian and Dropbox receive identical snapshots and retries survive restart without duplicate copies', async (t) => {
  const f = await fixture(t);
  let store = new ConnectionStore(f.config);
  store.setFolder('journal', f.journal);
  store.setFolder('obsidian', f.obsidian);
  store.setFolder('dropbox', f.dropbox);
  const jobs = store.enqueue(f.file);
  assert.equal(jobs.length, 2);
  store = new ConnectionStore(f.config);
  assert.equal(store.get().jobs.filter((j) => j.status === 'pending').length, 2);
  assert.ok((await store.retry()).every((job) => job.status === 'synced'));
  for (const folder of [f.obsidian, f.dropbox]) {
    const target = path.join(folder, 'TradeFrame', path.basename(path.dirname(f.file)));
    for (const name of ['setup.md', 'chart.png', 'chart-002.png']) {
      assert.deepEqual(await fs.readFile(path.join(target, name)), await fs.readFile(path.join(path.dirname(f.file), name)));
    }
    await copySnapshot(f.file, path.join(folder, 'TradeFrame'));
    assert.equal((await fs.readdir(path.join(folder, 'TradeFrame'))).length, 1);
  }
  const snapshot = store.get(); snapshot.folders.dropbox = null;
  assert.equal(store.get().folders.dropbox, f.dropbox);
});
test('one unavailable destination does not undo local save or block the other destination', async (t) => {
  const f = await fixture(t);
  let store = new ConnectionStore(f.config);
  store.setFolder('obsidian', f.obsidian);
  store.setFolder('dropbox', f.dropbox);
  store.enqueue(f.file);
  await fs.rmdir(f.dropbox);
  const jobs = await store.retry();
  assert.equal(jobs.find((j) => j.kind === 'obsidian').status, 'synced');
  assert.equal(jobs.find((j) => j.kind === 'dropbox').status, 'failed');
  await assert.rejects(fs.stat(f.dropbox));
  assert.match(await fs.readFile(f.file, 'utf8'), /Synthetic/);
  await fs.mkdir(f.dropbox);
  store = new ConnectionStore(f.config);
  assert.equal((await store.retry()).length, 1);
  assert.ok(store.get().jobs.every((job) => job.status === 'synced'));
});

test('follow-up screenshots extend the same files at both connected destinations', async (t) => {
  const f = await fixture(t);
  const store = new ConnectionStore(f.config);
  for (const kind of ['obsidian', 'dropbox']) store.setFolder(kind, f[kind]);
  store.enqueue(f.file); await store.retry();
  const loaded = await readSetup(f.file);
  await appendScreenshots(f.file, loaded.fingerprint, input, [...loaded.screenshots, { ...screenshots[0], id: 'follow-up', caption: 'Exit' }]);
  store.enqueue(f.file); await store.retry();
  for (const folder of [f.obsidian, f.dropbox]) {
    const target = path.join(folder, 'TradeFrame', path.basename(path.dirname(f.file)), 'setup.md');
    assert.equal((await readSetup(target)).screenshots.length, 3);
    assert.equal(await fs.readFile(target, 'utf8'), await fs.readFile(f.file, 'utf8'));
    assert.equal((await fs.readdir(path.join(folder, 'TradeFrame'))).length, 1);
  }
});
test('externally changed files are never overwritten; disconnect cancels outstanding deliveries', async (t) => {
  const f = await fixture(t);
  const store = new ConnectionStore(f.config);
  store.setFolder('obsidian', f.obsidian);
  const target = await copySnapshot(f.file, path.join(f.obsidian, 'TradeFrame'));
  await fs.writeFile(target, 'External note, preserve this');
  store.enqueue(f.file);
  assert.equal((await store.retry())[0].status, 'failed');
  assert.equal(await fs.readFile(target, 'utf8'), 'External note, preserve this');
  store.setFolder('obsidian', null);
  assert.equal((await store.retry()).length, 0);
  assert.equal(new ConnectionStore(f.config).get().folders.obsidian, null);
});
test('unrelated or malformed configuration is preserved and symlink destinations are rejected', async (t) => {
  const f = await fixture(t);
  await fs.writeFile(f.config, '{"version":999}').catch(async () => {
    await fs.mkdir(path.dirname(f.config)); await fs.writeFile(f.config, '{"version":999}');
  });
  assert.throws(() => new ConnectionStore(f.config), /Invalid connections/);
  assert.equal(await fs.readFile(f.config, 'utf8'), '{"version":999}');
  if (process.platform !== 'win32') {
    await fs.symlink(f.dropbox, path.join(f.obsidian, 'TradeFrame'));
    await assert.rejects(copySnapshot(f.file, path.join(f.obsidian, 'TradeFrame')), /Invalid sync/);
    assert.deepEqual(await fs.readdir(f.dropbox), []);
  }
});

test('a connected folder redirected after selection cannot receive deliveries', async (t) => {
  const f = await fixture(t);
  const store = new ConnectionStore(f.config);
  store.setFolder('obsidian', f.obsidian);
  store.enqueue(f.file);
  await fs.rename(f.obsidian, `${f.obsidian}-moved`);
  await fs.symlink(f.dropbox, f.obsidian, process.platform === 'win32' ? 'junction' : 'dir');
  assert.equal((await store.retry())[0].status, 'failed');
  assert.deepEqual(await fs.readdir(f.dropbox), []);
});
