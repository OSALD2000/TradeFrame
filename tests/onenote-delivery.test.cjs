const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { randomUUID } = require('node:crypto');
const { OneNoteClient, OneNoteError } = require('../dist-electron/onenote.js');
const { ConnectionStore } = require('../dist-electron/connections.js');
const { writeSetup, readSetup } = require('../dist-electron/journal.js');
const { DEFAULT_SCHEMA } = require('../dist-electron/form-schema.js');
const { restoreOneNote, pageText } = require('../dist-electron/onenote-content.js');
const graph = 'https://graph.microsoft.com/v1.0/me/onenote/';
const image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
const png = Buffer.from(image.split(',')[1], 'base64');
const json = (value, status = 200) => new Response(JSON.stringify(value), { status });
async function fixture(t, count = 2) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'tradeframe-cloud-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const values = { mode: 'live', symbol: "TEST + O'Brian", direction: 'long', model: 'Synthetic', timeframe: '5m', entryTimeNewYork: '', note: 'Synthetic <note>\nSecond line ä' };
  const file = await writeSetup(root, { schema: DEFAULT_SCHEMA, values }, Array.from({ length: count }, (_, index) => ({ id: String(index), image,
    caption: `View ${index + 1}\nLine two`, timeframe: `${index + 1}m`, capturedAt: '2026-11-01T12:00:00.000Z' })));
  let now = 0;
  const state = { html: '', title: '', creates: 0, patches: 0, requests: [], losePatch: 0, failure: 0, sectionPresent: true, resources: new Map() };
  async function output(input, body) {
    for (const [name, value] of body.entries()) if (!['Presentation', 'Commands'].includes(name)) state.resources.set(name, Buffer.from(await value.arrayBuffer()));
    return input.replace(/src="name:([^"]+)"/g, (_, name) => `data-fullres-src="${graph}resources/${name}/$value"`)
      .replace(/data="name:([^"]+)"/g, (_, name) => `data="${graph}resources/${name}/$value"`);
  }
  const request = async (url, options) => {
    if (url.endsWith('devicecode')) return json({ device_code: 'private-device', user_code: 'TEST', expires_in: 60, interval: 1 });
    if (url.endsWith('token')) return json({ access_token: 'private-access', expires_in: 3600 });
    assert.equal(options.headers.Authorization, 'Bearer private-access'); assert.equal(options.redirect, 'error');
    state.requests.push(url);
    const parsed = new URL(url); const resource = parsed.pathname;
    if (resource.endsWith('/notebooks')) return json({ value: [{ id: 'book', displayName: 'Synthetic notebook', isDefault: true }] });
    if (resource.endsWith('/sections')) {
      assert.notEqual(options.method, 'POST', 'Browsing must not create a section');
      return json({ value: state.sectionPresent ? [{ id: 'section', displayName: 'TradeFrame' }] : [] });
    }
    if (state.failure) return json({ error: { code: 'accessDenied', message: 'private raw diagnostic must never escape' } }, state.failure);
    if (resource.includes('/resources/')) {
      const name = resource.split('/').at(-2); assert.ok(state.resources.has(name)); return new Response(state.resources.get(name));
    }
    if (resource.endsWith('/pages/page/content') && options.method !== 'PATCH') return new Response(state.html);
    if (!['POST', 'PATCH'].includes(options.method)) {
      assert.ok(resource.endsWith('/pages'));
      if (parsed.searchParams.has('$filter')) { assert.ok(url.includes('%20')); assert.ok(!url.includes('+')); return json({ value: state.creates ? [{ id: 'page', title: state.title }] : [] }); }
      return json({ value: [...(state.creates ? [{ id: 'page', title: state.title, lastModifiedDateTime: '2026-11-01T12:00:00Z' }] : []), { id: 'other', title: 'Unrelated page' }] });
    }
    assert.ok([...options.body.keys()].length <= 6);
    assert.ok((await new Response(options.body).arrayBuffer()).byteLength < 4_000_000);
    if (options.method === 'POST') {
      state.creates++; assert.equal(resource, '/v1.0/me/onenote/sections/section/pages');
      const input = await options.body.get('Presentation').text();
      state.title = pageText(input.match(/<title>(.*?)<\/title>/)[1]);
      state.html = await output(input, options.body); return json({ id: 'page' }, 201);
    }
    state.patches++; assert.equal(resource, '/v1.0/me/onenote/pages/page/content');
    const commands = JSON.parse(await options.body.get('Commands').text());
    assert.equal(commands[0].target, 'body'); assert.equal(commands[0].action, 'append');
    state.html += await output(commands[0].content, options.body);
    if (state.patches === state.losePatch) throw new Error('Synthetic network response lost after accepted patch');
    return new Response(null, { status: 204 });
  };
  const secure = { isAsyncEncryptionAvailable: async () => false, getSelectedStorageBackend: () => 'basic_text' };
  const client = new OneNoteClient(root, secure, '11111111-2222-3333-4444-555555555555', request, () => now);
  await client.begin(); now = 1000; await client.poll(); await client.refreshNotebooks(); await client.selectNotebook('book');
  return { root, file, values, state, client };
}

test('20 screenshot setups upload within Graph limits and open losslessly from the chosen notebook', async (t) => {
  const f = await fixture(t, 20);
  await f.client.deliver(f.file, 'TradeFrame', randomUUID(), 'book');
  assert.equal(f.state.creates, 1); assert.equal(f.state.patches, 4);
  const pages = await f.client.listSetups(); assert.equal(pages.length, 1); assert.equal(pages[0].id, 'page');
  await assert.rejects(f.client.openSetup('other'), /choose a page/);
  const loaded = await f.client.openSetup('page'); const original = await readSetup(f.file);
  assert.equal(loaded.legacy, false); assert.deepEqual(loaded.schema, original.schema); assert.deepEqual(loaded.values, original.values);
  assert.deepEqual(loaded.screenshots.map(({ id, ...shot }) => shot), original.screenshots.map(({ id, ...shot }) => shot));
});

test('a partial upload with a lost PATCH response resumes without another page or duplicate images', async (t) => {
  const f = await fixture(t, 14); f.state.losePatch = 1;
  const id = randomUUID();
  await assert.rejects(f.client.deliver(f.file, 'TradeFrame', id, 'book'), /response lost/);
  assert.equal(f.state.creates, 1); assert.equal(f.state.patches, 1);
  await f.client.deliver(f.file, 'TradeFrame', id, 'book');
  assert.equal(f.state.creates, 1); assert.equal(f.state.patches, 2);
  await f.client.listSetups(); assert.equal((await f.client.openSetup('page')).screenshots.length, 14);
  await f.client.deliver(f.file, 'TradeFrame', id, 'book');
  assert.equal(f.state.patches, 2);
});

test('safe upload diagnostics survive in the queue while raw Microsoft and network messages do not', async (t) => {
  const f = await fixture(t); const store = new ConnectionStore(path.join(f.root, 'queue.json'));
  f.state.failure = 403; store.enqueue(f.file, 'TradeFrame', 'book');
  const failed = await store.retry(undefined, (...args) => f.client.deliver(...args));
  assert.match(failed[0].error, /HTTP 403, code accessDenied/); assert.match(failed[0].error, /Notes.ReadWrite/);
  assert.doesNotMatch(JSON.stringify(failed), /private raw diagnostic/);
  assert.equal(new ConnectionStore(path.join(f.root, 'queue.json')).get().jobs[0].error, failed[0].error);
  const generic = await store.retry(undefined, async () => { throw new Error('private-token-or-network-detail'); });
  assert.doesNotMatch(generic[0].error, /private-token/);
});

test('cloud resources reject external URLs, foreign paths and changed image bytes before altering a draft', async (t) => {
  const f = await fixture(t); await f.client.deliver(f.file, 'TradeFrame', randomUUID(), 'book'); await f.client.listSetups();
  const html = f.state.html;
  for (const target of ['https://evil.example/resources/setup/$value', graph+'pages/other/content']) {
    f.state.html = html.replace(graph+'resources/setup/$value', target);
    const before = f.state.requests.length;
    await assert.rejects(f.client.openSetup('page'), /unsupported resource/);
    assert.equal(f.state.requests.length, before + 1);
  }
  f.state.html = html; f.state.resources.set('chart0', Buffer.concat([png, Buffer.from('changed')]));
  await assert.rejects(f.client.openSetup('page'), /differs/);
});

test('oversized single images fail visibly before creating a cloud page and empty browsing never writes', async (t) => {
  const f = await fixture(t); f.state.sectionPresent = false;
  assert.deepEqual(await f.client.listSetups(), []); assert.equal(f.state.creates, 0);
  const huge = Buffer.alloc(3_900_000); png.copy(huge);
  const original = await readSetup(f.file);
  const file = await writeSetup(f.root, { schema: original.schema, values: original.values }, [{ ...original.screenshots[0], image: `data:image/png;base64,${huge.toString('base64')}` }]);
  await assert.rejects(f.client.deliver(file, 'TradeFrame', randomUUID(), 'book'), /below 3.8 MB/);
  assert.equal(f.state.creates, 0);
});

test('older TradeFrame pages restore standard fields, captions and original PNGs without a snapshot', async () => {
  const values = { mode: 'live', symbol: 'TEST', direction: 'long', model: 'Synthetic', timeframe: '5m', entryTimeNewYork: '', note: 'Legacy & note\nSecond line' };
  const fields = DEFAULT_SCHEMA.fields.map((field) => `<h2>${field.label}</h2><p>${String(values[field.id]).replace(/&/g, '&amp;').replace(/\n/g, '<br />')}</p>`).join('');
  const html = `<html><head><title>TradeFrame</title></head><body><h2>Screenshot 1 · 2m</h2><p>Caption<br />Line two</p><img alt="Chart 1" data-fullres-src="${graph}resources/img/$value" /><p>2026-11-01T12:00:00.000Z</p>${fields}<p>Manually added paragraph</p><p>#tags</p></body></html>`;
  const loaded = await restoreOneNote(html, async () => png);
  assert.equal(loaded.legacy, true);
  const { note, ...recovered } = loaded.values;
  const { note: originalNote, ...originalFields } = values;
  assert.deepEqual(recovered, originalFields); assert.ok(note.includes(originalNote)); assert.match(note, /Manually added paragraph/);
  assert.equal(loaded.schema.id, DEFAULT_SCHEMA.id);
  assert.equal(loaded.screenshots[0].timeframe, '2m'); assert.equal(loaded.screenshots[0].caption, 'Caption\nLine two');
});

test('disconnecting during a cloud image download cannot restore a stale account draft', async (t) => {
  const f = await fixture(t); await f.client.deliver(f.file, 'TradeFrame', randomUUID(), 'book'); await f.client.listSetups();
  const request = f.client.request; let release;
  f.client.request = (url, options) => url.includes('/resources/chart0/') ? new Promise((resolve) => { release = resolve; }) : request(url, options);
  const pending = f.client.openSetup('page');
  while (!release) await new Promise(setImmediate);
  await f.client.disconnect(); release(new Response(png));
  await assert.rejects(pending, /disconnected/);
  assert.equal((await f.client.getState()).notebook, null);
});
