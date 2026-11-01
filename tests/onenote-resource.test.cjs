const { test } = require('node:test');
const assert = require('node:assert/strict');
const { OneNoteClient, OneNoteError: publicError } = require('../dist-electron/onenote.js');
const { OneNoteError } = require('../dist-electron/onenote-error.js');
const { oneNoteResourceUrl } = require('../dist-electron/onenote-resource.js');

test('resource normalization is pure and the public error export retains its shared identity', () => {
  assert.equal(publicError, OneNoteError);
  assert.equal(
    oneNoteResourceUrl(
      "https://graph.microsoft.com/v1.0/users('synthetic')/onenote/resources/asset/$value?unused=hidden",
    ),
    'https://graph.microsoft.com/v1.0/users/synthetic/onenote/resources/asset/content',
  );
  assert.equal(
    oneNoteResourceUrl('https://www.onenote.com/api/v1.0/me/notes/resources/asset/$value'),
    'https://graph.microsoft.com/v1.0/me/onenote/resources/asset/content',
  );
  for (const value of [undefined, null, '', 'relative/path', 'x'.repeat(8193)]) {
    assert.throws(
      () => oneNoteResourceUrl(value),
      (error) => {
        assert.ok(error instanceof OneNoteError);
        assert.equal(
          error.message,
          'OneNote returned an unsupported resource link (missing or invalid URL).',
        );
        return true;
      },
    );
  }
});

test('resource delegation keeps cancellation ahead of parsing and never requests an invalid link', async () => {
  let requests = 0;
  const client = new OneNoteClient('', {}, '', async () => {
    requests++;
    return new Response('payload');
  });
  await assert.rejects(client.resource('invalid', {}, 1, 100), (error) => {
    assert.ok(error instanceof OneNoteError);
    assert.equal(error.message, 'OneNote was disconnected.');
    return true;
  });
  await assert.rejects(client.resource('invalid', {}, 0, 100), (error) => {
    assert.ok(error instanceof OneNoteError);
    assert.equal(
      error.message,
      'OneNote returned an unsupported resource link (missing or invalid URL).',
    );
    return true;
  });
  assert.equal(requests, 0);
});

test('resource delegation preserves authenticated request options and download limits', async () => {
  const headers = { Authorization: 'Bearer synthetic' };
  const client = new OneNoteClient('', {}, '', async (url, options) => {
    assert.equal(url, 'https://graph.microsoft.com/v1.0/me/onenote/resources/asset/content');
    assert.equal(options.headers, headers);
    assert.equal(options.redirect, 'error');
    assert.ok(options.signal instanceof AbortSignal);
    return new Response('payload');
  });
  const url = 'https://graph.microsoft.com/v1.0/me/onenote/resources/asset/$value';
  assert.equal((await client.resource(url, headers, 0, 100)).toString(), 'payload');
  await assert.rejects(client.resource(url, headers, 0, 2), (error) => {
    assert.ok(error instanceof OneNoteError);
    assert.equal(error.message, 'OneNote content exceeds the supported size.');
    return true;
  });
});
