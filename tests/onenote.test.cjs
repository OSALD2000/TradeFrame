const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { randomUUID } = require('node:crypto');
const { OneNoteClient } = require('../dist-electron/onenote.js');
const { writeSetup } = require('../dist-electron/journal.js');
const { DEFAULT_SCHEMA } = require('../dist-electron/form-schema.js');
const clientId = '11111111-2222-3333-4444-555555555555';
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
function encryption(available = true) {
  const vault = new Map();
  return {
    isAsyncEncryptionAvailable: async () => available,
    getSelectedStorageBackend: () => available ? 'gnome_libsecret' : 'basic_text',
    encryptStringAsync: async (value) => { const id = randomUUID(); vault.set(id, value); return Buffer.from(id); },
    decryptStringAsync: async (value) => ({ result: vault.get(value.toString()), shouldReEncrypt: false }),
  };
}
async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'tradeframe-onenote-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  return root;
}
test('device login respects polling intervals, hides credentials, encrypts refresh tokens and refreshes after restart', async (t) => {
  const root = await fixture(t);
  let now = 1_000_000;
  let calls = 0;
  let grant;
  const request = async (url, options) => {
    calls++;
    assert.ok(url.startsWith('https://login.microsoftonline.com/common/oauth2/v2.0/'));
    assert.equal(options.redirect, 'error');
    assert.equal(options.body.get('client_id'), clientId);
    if (url.endsWith('devicecode')) return json({ device_code: 'private-device-code', user_code: 'TEST-CODE', expires_in: 900, interval: 5 });
    grant = options.body.get('grant_type');
    return json({ access_token: 'private-access-token', refresh_token: 'private-refresh-token', expires_in: 3600 });
  };
  const secure = encryption();
  let client = new OneNoteClient(root, secure, clientId, request, () => now);
  const state = await client.begin();
  assert.equal(state.login.userCode, 'TEST-CODE');
  assert.doesNotMatch(JSON.stringify(state), /private-|deviceCode|accessToken|refreshToken/);
  await client.poll(); assert.equal(calls, 1);
  now += 5000;
  const connected = await client.poll();
  assert.equal(connected.connected, true); assert.equal(connected.durable, true);
  assert.equal(grant, 'urn:ietf:params:oauth:grant-type:device_code');
  assert.doesNotMatch((await fs.readFile(path.join(root, 'onenote-token.bin'))).toString(), /private-/);
  client = new OneNoteClient(root, secure, clientId, request, () => now);
  assert.equal((await client.getState()).connected, true);
  await client.token();
  assert.equal(grant, 'refresh_token');
  await client.disconnect();
  await assert.rejects(fs.stat(path.join(root, 'onenote-token.bin')));
  assert.equal((await new OneNoteClient(root, secure, clientId, request).getState()).connected, false);
});
test('pending, throttled, denied and expired sign-ins remain recoverable; insecure storage is session-only', async (t) => {
  const root = await fixture(t);
  let now = 0;
  let tokenCalls = 0;
  const replies = ['authorization_pending', 'slow_down', 'authorization_declined'];
  const request = async (url) => url.endsWith('devicecode')
    ? json({ device_code: 'test', user_code: 'TEST', expires_in: 60, interval: 5 })
    : json({ error: replies[tokenCalls++] }, 400);
  const client = new OneNoteClient(root, encryption(false), clientId, request, () => now);
  await client.begin();
  now = 5000; assert.ok((await client.poll()).login);
  now = 10000; assert.ok((await client.poll()).login);
  now = 15000; await client.poll(); assert.equal(tokenCalls, 2);
  now = 20000; assert.equal((await client.poll()).login, null);
  assert.match((await client.getState()).error, /declined/);
  await client.begin(); now = 90000;
  assert.match((await client.poll()).error, /expired/);
  const session = new OneNoteClient(root, encryption(false), clientId, async (url) => url.endsWith('devicecode')
    ? json({ device_code: 'test', user_code: 'TEST', expires_in: 60, interval: 1 })
    : json({ access_token: 'session-access', refresh_token: 'session-refresh', expires_in: 3600 }), () => now);
  await session.begin(); now += 1000;
  assert.equal((await session.poll()).connected, true);
  assert.equal((await session.getState()).durable, false);
  await assert.rejects(fs.stat(path.join(root, 'onenote-token.bin')));
});
test('OneNote sends escaped fields and all images; retry after a lost response finds the existing page', async (t) => {
  const root = await fixture(t);
  const image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
  const file = await writeSetup(root, { schema: DEFAULT_SCHEMA, values: {
    mode: 'live', symbol: 'TEST', direction: 'long', model: 'Synthetic', timeframe: '5m', entryTimeNewYork: '', note: '<script>synthetic</script>\nSecond line',
  } }, [1, 2].map((id) => ({ id: String(id), image, caption: 'Entry <entry>', capturedAt: '2026-10-30T12:00:00.000Z', timeframe: `${id}m` })));
  let now = 0;
  let created = false;
  let posts = 0;
  let title;
  const request = async (url, options) => {
    if (url.endsWith('devicecode')) return json({ device_code: 'test', user_code: 'TEST', expires_in: 60, interval: 1 });
    if (url.endsWith('token')) return json({ access_token: 'synthetic-access', refresh_token: 'synthetic-refresh', expires_in: 3600 });
    assert.equal(options.headers.Authorization, 'Bearer synthetic-access');
    assert.ok(url.startsWith('https://graph.microsoft.com/v1.0/me/onenote/pages?'));
    if (options.method !== 'POST') return json({ value: created ? [{ id: 'page-1', title }] : [] });
    posts++;
    const html = await options.body.get('Presentation').text();
    assert.match(html, /&lt;script&gt;synthetic&lt;\/script&gt;<br \/>Second line/);
    assert.match(html, /&lt;entry&gt;/);
    assert.doesNotMatch(html, /<script>/);
    assert.match(html, /src="name:chart0"/); assert.match(html, /src="name:chart1"/);
    assert.match(html, /Screenshot 1 · 1m/); assert.match(html, /Screenshot 2 · 2m/);
    assert.equal(options.body.get('chart0').type, 'image/png');
    assert.equal(options.body.get('chart1').size, Buffer.from(image.split(',')[1], 'base64').length);
    title = /<title>(.*?)<\/title>/.exec(html)[1];
    created = true;
    throw new Error('Synthetic response lost after server accepted upload');
  };
  const client = new OneNoteClient(root, encryption(), clientId, request, () => now);
  await client.begin(); now = 1000; await client.poll();
  const id = randomUUID();
  await assert.rejects(client.deliver(file, 'TradeFrame', id), /response lost/);
  await client.deliver(file, 'TradeFrame', id);
  assert.equal(posts, 1);
  await assert.rejects(client.deliver(file, '../wrong', id), /Invalid/);
});
