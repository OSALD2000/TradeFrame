const { test } = require('node:test');
const assert = require('node:assert/strict');
const { OneNoteClient, OneNoteError } = require('../dist-electron/onenote.js');
const { OneNoteGraph } = require('../dist-electron/onenote-graph.js');

test('Graph transport construction is inert and sending preserves the HTTP promise and synchronous errors', () => {
  let calls = 0;
  const result = Promise.resolve(new Response('synthetic'));
  const options = { method: 'PATCH', headers: { Authorization: 'Bearer synthetic' } };
  const session = {
    generation: () => assert.fail('Sending alone must not inspect account state'),
    invalidateAccessToken: () => assert.fail('Sending alone must not invalidate an account'),
  };
  const graph = new OneNoteGraph((url, supplied) => {
    calls++;
    assert.equal(url, 'https://graph.microsoft.com/v1.0/me/onenote/pages/synthetic/content');
    assert.equal(supplied, options);
    return result;
  }, session);
  assert.equal(calls, 0);
  assert.equal(graph.send('pages/synthetic/content', options), result);
  assert.equal(calls, 1);
  const failure = new Error('Synthetic transport failure');
  const failing = new OneNoteGraph(() => {
    throw failure;
  }, session);
  assert.throws(
    () => failing.send('pages', options),
    (error) => error === failure,
  );
});

test('Graph requests preserve the client receiver and observe a replaced HTTP dependency', async () => {
  const client = new OneNoteClient('', {}, '', () => {
    assert.fail('The replaced request function must not run');
  });
  const headers = { Authorization: 'Bearer synthetic' };
  client.request = function (url, options) {
    assert.equal(this, client);
    assert.equal(url, 'https://graph.microsoft.com/v1.0/me/onenote/pages/page%2Fone/content');
    assert.equal(options.headers, headers);
    assert.equal(options.redirect, 'error');
    assert.ok(options.signal instanceof AbortSignal);
    return Promise.resolve(new Response('original content'));
  };
  assert.equal(await client.content('page/one', headers, 0), 'original content');
});

test('Graph 401 invalidates the access token before awaiting its safe error body', async () => {
  const client = new OneNoteClient('', {});
  client.accessToken = 'synthetic';
  let finish;
  const body = new Promise((resolve) => {
    finish = resolve;
  });
  const result = client.checkResponse(
    {
      ok: false,
      status: 401,
      json: () => {
        assert.equal(client.accessToken, '');
        return body;
      },
    },
    'read notebooks or sections',
  );
  assert.equal(client.accessToken, '');
  finish({ error: { code: 'InvalidAuthenticationToken', message: 'private detail' } });
  await assert.rejects(result, (error) => {
    assert.ok(error instanceof OneNoteError);
    assert.equal(
      error.message,
      'OneNote could not read notebooks or sections (HTTP 401, code InvalidAuthenticationToken). Reconnect OneNote.',
    );
    return true;
  });
});

test('a stale collection response is rejected before reading errors or invalidating a token', async () => {
  let finish;
  const response = new Promise((resolve) => {
    finish = resolve;
  });
  const client = new OneNoteClient('', {}, '', () => response);
  client.accessToken = 'synthetic';
  const result = client.collection('notebooks', {}, 0);
  client.generation++;
  finish({
    ok: false,
    status: 401,
    json: () => assert.fail('A stale response body must not be read'),
  });
  await assert.rejects(result, { name: 'Error', message: 'OneNote was disconnected' });
  assert.equal(client.accessToken, 'synthetic');
});

test('a collection changing accounts while reading JSON cannot publish its rows', async () => {
  const client = new OneNoteClient('', {}, '', async () => ({
    ok: true,
    json: async () => {
      client.generation++;
      return { value: [{ id: 'synthetic', displayName: 'Synthetic' }] };
    },
  }));
  await assert.rejects(client.collection('notebooks', {}, 0), {
    name: 'Error',
    message: 'OneNote was disconnected',
  });
});

test('Graph downloads cancel the reader on size failure, account change and read failure', async () => {
  for (const scenario of ['size', 'account', 'read']) {
    let cancelled = 0;
    const client = new OneNoteClient('', {}, '', async () => ({
      ok: true,
      body: {
        getReader: () => ({
          read: async () => {
            if (scenario === 'read') throw new Error('Synthetic read failure');
            if (scenario === 'account') {
              client.generation++;
              return { done: true };
            }
            return { done: false, value: Buffer.from('too large') };
          },
          cancel: async () => {
            cancelled++;
          },
        }),
      },
    }));
    await assert.rejects(
      client.resource(
        'https://graph.microsoft.com/v1.0/me/onenote/resources/asset/content',
        {},
        0,
        2,
      ),
      {
        message:
          scenario === 'size'
            ? 'OneNote content exceeds the supported size.'
            : scenario === 'account'
              ? 'OneNote was disconnected.'
              : 'Synthetic read failure',
      },
    );
    assert.equal(cancelled, 1);
  }
});
