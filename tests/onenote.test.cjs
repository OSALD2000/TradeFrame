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
  const encrypt = (value) => { const id = randomUUID(); vault.set(id, value); return Buffer.from(id); };
  return {
    isEncryptionAvailable: () => available,
    isAsyncEncryptionAvailable: async () => available,
    getSelectedStorageBackend: () => available ? 'gnome_libsecret' : 'basic_text',
    encryptString: encrypt,
    encryptStringAsync: async (value) => encrypt(value),
    decryptStringAsync: async (value) => ({ result: vault.get(value.toString()), shouldReEncrypt: false }),
  };
}
async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'tradeframe-onenote-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  return root;
}

test('a rejected application ID can be corrected, removed and stays removed after restart', async (t) => {
  const root = await fixture(t);
  const replacement = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
  let accepted = false;
  const request = async (_, options) => {
    assert.equal(options.body.get('client_id'), accepted ? replacement : clientId);
    return accepted ? json({ device_code: 'private-code', user_code: 'NEW-CODE', expires_in: 60, interval: 1 })
      : json({ error: 'unauthorized_client', error_description: 'private diagnostic details' }, 400);
  };
  let client = new OneNoteClient(root, encryption(), '', request);
  await client.configure(clientId);
  const failed = await client.begin();
  assert.equal(failed.applicationId, clientId); assert.equal(failed.customApplicationId, true);
  assert.match(failed.error, /Application \(client\) ID/);
  assert.doesNotMatch(JSON.stringify(failed), /private diagnostic/);
  await assert.rejects(client.configure('not-a-uuid'), /valid Microsoft/);
  assert.equal((await client.getState()).applicationId, clientId);
  await client.configure(replacement); accepted = true;
  assert.equal((await client.begin()).login.userCode, 'NEW-CODE');
  const reset = await client.configure('');
  assert.equal(reset.configured, false); assert.equal(reset.customApplicationId, false);
  assert.equal(reset.login, null); assert.equal(reset.error, null);
  await assert.rejects(fs.stat(path.join(root, 'onenote.json')), { code: 'ENOENT' });
  client = new OneNoteClient(root, encryption());
  assert.equal((await client.getState()).applicationId, '');
});
test('Linux initializes and uses the checked keyring provider before persisting sign-in', { skip: process.platform !== 'linux' }, async (t) => {
  const root = await fixture(t); const secure = encryption(); let initialized = false; let now = 0;
  secure.isEncryptionAvailable = () => { initialized = true; return true; };
  secure.getSelectedStorageBackend = () => initialized ? 'gnome_libsecret' : 'unknown';
  secure.encryptStringAsync = async () => { throw new Error('The unchecked async fallback must not store credentials'); };
  const request = async (url) => url.endsWith('devicecode')
    ? json({ device_code: 'private-code', user_code: 'TEST', expires_in: 60, interval: 1 })
    : json({ access_token: 'private-access', refresh_token: 'private-refresh', expires_in: 3600 });
  let client = new OneNoteClient(root, secure, clientId, request, () => now);
  await client.begin(); now = 1000;
  assert.equal((await client.poll()).durable, true); assert.equal(initialized, true);
  client = new OneNoteClient(root, secure, clientId, request, () => now);
  assert.equal((await client.getState()).connected, true);
  assert.equal(await client.token(), 'private-access');
  await client.disconnect();
  secure.getSelectedStorageBackend = () => 'basic_text';
  await client.begin(); now += 1000;
  const session = await client.poll(); assert.equal(session.connected, true); assert.equal(session.durable, false);
  await assert.rejects(fs.stat(path.join(root, 'onenote-token.bin')), { code: 'ENOENT' });
});

test('removing a custom ID disconnects persisted credentials and restores the publisher default', async (t) => {
  const root = await fixture(t);
  const secure = encryption();
  let now = 0;
  const replacement = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
  const request = async (url) => url.endsWith('devicecode')
    ? json({ device_code: 'private-code', user_code: 'TEST', expires_in: 60, interval: 1 })
    : json({ access_token: 'private-access', refresh_token: 'private-refresh', expires_in: 3600 });
  let client = new OneNoteClient(root, secure, clientId, request, () => now);
  await client.configure(replacement); await client.begin(); now += 1000; await client.poll();
  assert.equal((await client.getState()).connected, true);
  await fs.stat(path.join(root, 'onenote-token.bin'));
  const reset = await client.configure('');
  assert.equal(reset.connected, false); assert.equal(reset.durable, false);
  assert.equal(reset.applicationId, clientId); assert.equal(reset.customApplicationId, false);
  await assert.rejects(fs.stat(path.join(root, 'onenote-token.bin')), { code: 'ENOENT' });
  client = new OneNoteClient(root, secure, clientId);
  assert.equal((await client.getState()).applicationId, clientId);
  assert.equal((await client.getState()).connected, false);
});

test('unreadable application settings and network failures leave reset available', async (t) => {
  const root = await fixture(t);
  await fs.writeFile(path.join(root, 'onenote.json'), '{invalid');
  const client = new OneNoteClient(root, encryption(), '', async () => { throw new Error('private network detail'); });
  assert.equal((await client.getState()).customApplicationId, true);
  await client.configure('');
  assert.equal((await client.getState()).customApplicationId, false);
  await client.configure(clientId);
  const state = await client.begin();
  assert.match(state.error, /Could not reach Microsoft/);
  assert.doesNotMatch(JSON.stringify(state), /private network/);
  assert.equal(state.customApplicationId, true);
});
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
  } }, [1, 2].map((id) => ({ id: String(id), image, caption: 'Entry <entry>\nSecond paragraph', capturedAt: '2026-10-30T12:00:00.000Z', timeframe: `${id}m` })));
  let now = 0;
  let created = false;
  let posts = 0;
  let title;
  let cloudHtml; let snapshot;
  const request = async (url, options) => {
    if (url.endsWith('devicecode')) return json({ device_code: 'test', user_code: 'TEST', expires_in: 60, interval: 1 });
    if (url.endsWith('token')) return json({ access_token: 'synthetic-access', refresh_token: 'synthetic-refresh', expires_in: 3600 });
    assert.equal(options.headers.Authorization, 'Bearer synthetic-access');
    const resource = new URL(url).pathname;
    if (resource.includes('/pages/') && resource.endsWith('/content')) return new Response(cloudHtml);
    if (resource.includes('/resources/setup/')) return new Response(snapshot);
    if (resource.includes('/resources/image')) return new Response(Buffer.from(image.split(',')[1], 'base64'));
    assert.ok(url.startsWith('https://graph.microsoft.com/v1.0/me/onenote/pages?'));
    if (options.method !== 'POST') return json({ value: created ? [{ id: 'page-1', title }] : [] });
    posts++;
    const html = await options.body.get('Presentation').text();
    assert.match(html, /&lt;script&gt;synthetic&lt;\/script&gt;<br \/>Second line/);
    assert.match(html, /&lt;entry&gt;/);
    assert.match(html, /&lt;entry&gt;<br \/>Second paragraph/);
    assert.doesNotMatch(html, /<script>/);
    assert.match(html, /src="name:chart0"/); assert.match(html, /src="name:chart1"/);
    assert.match(html, /Screenshot 1 · 1m/); assert.match(html, /Screenshot 2 · 2m/);
    assert.equal(options.body.get('chart0').type, 'image/png');
    assert.equal(options.body.get('chart1').size, Buffer.from(image.split(',')[1], 'base64').length);
    title = /<title>(.*?)<\/title>/.exec(html)[1];
    snapshot = await options.body.get('setup').text();
    cloudHtml = html.replace(/src="name:chart(\d+)"/g, (_, id) => `data-fullres-src="https://graph.microsoft.com/v1.0/me/onenote/resources/image${id}/$value"`)
      .replace('data="name:setup"', 'data="https://graph.microsoft.com/v1.0/me/onenote/resources/setup/$value"');
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
