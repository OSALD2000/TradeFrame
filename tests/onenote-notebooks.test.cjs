const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { randomUUID } = require('node:crypto');
const { OneNoteClient } = require('../dist-electron/onenote.js');
const { ConnectionStore } = require('../dist-electron/connections.js');
const { writeSetup } = require('../dist-electron/journal.js');
const { DEFAULT_SCHEMA } = require('../dist-electron/form-schema.js');
const clientId = '11111111-2222-3333-4444-555555555555';
const graph = 'https://graph.microsoft.com/v1.0/me/onenote/';
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
const notebooks = [{ id: 'default!1', displayName: 'Default', isDefault: true }, { id: 'chosen/2', displayName: 'Trading & Review', isDefault: false }];
const image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
async function fixture(t, request) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'tradeframe-notebooks-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  let now = 0;
  const vault = new Map();
  const secure = { isAsyncEncryptionAvailable: async () => true, getSelectedStorageBackend: () => 'gnome_libsecret',
    encryptStringAsync: async (value) => { const id = randomUUID(); vault.set(id, value); return Buffer.from(id); },
    decryptStringAsync: async (value) => ({ result: vault.get(value.toString()), shouldReEncrypt: false }) };
  const network = async (url, options) => {
    if (url.endsWith('devicecode')) return json({ device_code: 'private-code', user_code: 'TEST', expires_in: 60, interval: 1 });
    if (url.endsWith('token')) return json({ access_token: 'private-access', refresh_token: 'private-refresh', expires_in: 3600 });
    assert.equal(options.headers.Authorization, 'Bearer private-access');
    assert.equal(options.redirect, 'error');
    return request(url, options);
  };
  const client = new OneNoteClient(root, secure, clientId, network, () => now);
  await client.begin(); now = 1000; await client.poll();
  return { root, client, secure, network, now: () => now };
}

test('notebooks load across pages and the chosen ID survives restart but clears on a new account sign-in', async (t) => {
  let calls = 0;
  const f = await fixture(t, async (url) => {
    assert.equal(new URL(url).pathname, '/v1.0/me/onenote/notebooks');
    return ++calls === 1 ? json({ value: [notebooks[0]], '@odata.nextLink': graph + 'notebooks?$skip=1' }) : json({ value: [notebooks[1]] });
  });
  assert.equal((await f.client.getState()).notebook, null);
  const loaded = await f.client.refreshNotebooks();
  assert.deepEqual(loaded.notebooks, notebooks);
  await assert.rejects(f.client.selectNotebook('unknown'), /available notebook/);
  await f.client.selectNotebook(notebooks[1].id);
  const state = await f.client.getState(); state.notebook.displayName = 'Changed outside'; state.notebooks.length = 0;
  assert.equal((await f.client.getState()).notebook.displayName, notebooks[1].displayName);
  let restarted = new OneNoteClient(f.root, f.secure, clientId, f.network, f.now);
  assert.equal((await restarted.getState()).notebook.id, notebooks[1].id);
  assert.equal((await restarted.getState()).connected, true);
  await restarted.begin();
  assert.equal((await restarted.getState()).notebook, null);
  await assert.rejects(fs.stat(path.join(f.root, 'onenote-notebook.json')), { code: 'ENOENT' });
});

test('untrusted pagination never receives a bearer token and malformed/duplicate notebook lists fail', async (t) => {
  let mode = 'external'; let calls = 0;
  const f = await fixture(t, async (url) => {
    calls++; assert.ok(url.startsWith(graph+'notebooks'));
    if (mode === 'external') return json({ value: notebooks, '@odata.nextLink': 'https://other.example/notebooks' });
    if (mode === 'other-collection') return json({ value: notebooks, '@odata.nextLink': graph+'pages' });
    if (mode === 'duplicate') return json({ value: [notebooks[0], notebooks[0]] });
    return json({ value: [{ id: '..', displayName: 'Invalid' }] });
  });
  for (mode of ['external', 'other-collection', 'duplicate', 'invalid-id']) {
    assert.match((await f.client.refreshNotebooks()).error, /Could not load notebooks/);
    assert.equal((await f.client.getState()).notebooks.length, 0);
  }
  assert.equal(calls, 4);
});

test('a late notebook response cannot restore account state after disconnect', async (t) => {
  let release;
  const f = await fixture(t, () => new Promise((resolve) => { release = resolve; }));
  const pending = f.client.refreshNotebooks();
  while (!release) await new Promise(setImmediate);
  await f.client.disconnect(); release(json({ value: notebooks }));
  const state = await pending;
  assert.equal(state.connected, false); assert.equal(state.notebook, null); assert.deepEqual(state.notebooks, []);
});

test('selected notebook section is created once and lost page responses retry in the same section', async (t) => {
  let sectionExists = false; let pageExists = false; let title; let posts = 0; let sectionPosts = 0; let cloudHtml; let snapshot;
  const f = await fixture(t, async (url, options) => {
    const resource = new URL(url).pathname;
    if (resource.endsWith('/pages/page!1/content')) return new Response(cloudHtml);
    if (resource.includes('/resources/setup/')) return new Response(snapshot);
    if (resource.includes('/resources/image/')) return new Response(Buffer.from(image.split(',')[1], 'base64'));
    if (resource.endsWith('/notebooks')) return json({ value: notebooks });
    if (resource === '/v1.0/me/onenote/notebooks/chosen%2F2/sections') {
      if (options.method === 'POST') { sectionPosts++; sectionExists = true; assert.deepEqual(JSON.parse(options.body), { displayName: 'TradeFrame' }); return json({ id: 'section!1', displayName: 'TradeFrame' }, 201); }
      return json({ value: sectionExists ? [{ id: 'section!1', displayName: 'TradeFrame' }] : [] });
    }
    assert.equal(resource, '/v1.0/me/onenote/sections/section!1/pages', 'No default notebook endpoint may be used');
    if (options.method !== 'POST') return json({ value: pageExists ? [{ id: 'page!1', title }] : [] });
    posts++; const html = await options.body.get('Presentation').text(); title = /<title>(.*?)<\/title>/.exec(html)[1]; pageExists = true;
    snapshot = await options.body.get('setup').text();
    cloudHtml = html.replace('src="name:chart0"', 'data-fullres-src="https://graph.microsoft.com/v1.0/me/onenote/resources/image/$value"')
      .replace('data="name:setup"', 'data="https://graph.microsoft.com/v1.0/me/onenote/resources/setup/$value"');
    throw new Error('Synthetic response lost after successful page creation');
  });
  await f.client.refreshNotebooks(); await f.client.selectNotebook(notebooks[1].id);
  const file = await writeSetup(f.root, { schema: DEFAULT_SCHEMA, values: { mode: 'live', symbol: 'TEST', direction: 'long', model: 'Example', timeframe: '1m', entryTimeNewYork: '', note: '' } },
    [{ id: 'shot', image, caption: 'Synthetic note', capturedAt: '2026-11-01T12:00:00.000Z', timeframe: '1m' }]);
  const job = randomUUID();
  await assert.rejects(f.client.deliver(file, 'TradeFrame', job, notebooks[1].id), /response lost/);
  await f.client.deliver(file, 'TradeFrame', job, notebooks[1].id);
  assert.equal(posts, 1); assert.equal(sectionPosts, 1);
  await f.client.disconnect();
  assert.equal((await f.client.getState()).notebook, null);
});

test('an unavailable chosen notebook never falls back to the default notebook', async (t) => {
  let gone = false;
  const f = await fixture(t, async (url) => {
    if (new URL(url).pathname.endsWith('/notebooks')) return json({ value: gone ? [notebooks[0]] : notebooks });
    assert.ok(url.includes('/notebooks/chosen%2F2/sections'));
    return json({ error: { code: 'notFound' } }, 404);
  });
  await f.client.refreshNotebooks(); await f.client.selectNotebook(notebooks[1].id); gone = true;
  assert.match((await f.client.refreshNotebooks()).error, /unavailable/);
  const file = await writeSetup(f.root, { schema: DEFAULT_SCHEMA, values: { mode: 'live', symbol: 'TEST', direction: 'long', model: 'Example', timeframe: '1m', entryTimeNewYork: '', note: '' } },
    [{ id: 'shot', image, caption: '', capturedAt: '2026-11-01T12:00:00.000Z', timeframe: '1m' }]);
  await assert.rejects(f.client.deliver(file, 'TradeFrame', randomUUID(), notebooks[1].id), /could not read/);
});

test('legacy connection settings are backed up and notebook destinations stay pinned in version 2 jobs', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'tradeframe-connections-v2-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const file = path.join(root, 'connections.json'); const source = path.join(root, 'synthetic.md');
  const original = JSON.stringify({ version: 1, folders: { journal: null, obsidian: null, dropbox: null },
    jobs: [{ id: randomUUID(), kind: 'onenote', section: 'TradeFrame', source, status: 'pending', error: null }] });
  await fs.writeFile(file, original);
  let store = new ConnectionStore(file);
  assert.equal(await fs.readFile(file, 'utf8'), original);
  store.enqueue(source, 'TradeFrame', notebooks[1].id);
  assert.equal(await fs.readFile(file+'.v1.bak', 'utf8'), original);
  assert.equal(JSON.parse(await fs.readFile(file, 'utf8')).version, 2);
  store = new ConnectionStore(file);
  const targets = [];
  await store.retry(undefined, async (_, section, id, notebookId) => { assert.equal(section, 'TradeFrame'); targets.push(notebookId); });
  assert.deepEqual(targets, [undefined, notebooks[1].id]);
  store.setFolder('journal', root); assert.equal(await fs.readFile(file+'.v1.bak', 'utf8'), original);
  const invalid = JSON.parse(original); invalid.jobs[0].notebookId = notebooks[1].id;
  const wrongFile = path.join(root, 'invalid.json'); await fs.writeFile(wrongFile, JSON.stringify(invalid));
  assert.throws(() => new ConnectionStore(wrongFile), /Invalid OneNote notebook/);
});
