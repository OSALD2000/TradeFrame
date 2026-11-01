const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { randomUUID } = require('node:crypto');
const { createConnector } = require('../dist-electron/connector-factory.js');
const { copySnapshot } = require('../dist-electron/connections.js');
const folder = require('../dist-electron/folder-connector.js');
const { writeSetup } = require('../dist-electron/journal.js');
const { DEFAULT_SCHEMA } = require('../dist-electron/form-schema.js');
const { OneNoteError } = require('../dist-electron/onenote-error.js');

test('factory routes both folder destinations through the original snapshot copy contract', async (t) => {
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'tradeframe-factory-')));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  assert.equal(copySnapshot, folder.copySnapshot);
  const source = await writeSetup(
    root,
    {
      schema: DEFAULT_SCHEMA,
      values: {
        mode: 'live',
        symbol: 'TEST',
        direction: 'long',
        model: 'Synthetic',
        timeframe: '5m',
        entryTimeNewYork: '',
        note: 'Original',
      },
    },
    [
      {
        id: 'shot',
        image:
          'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
        caption: 'Synthetic',
        capturedAt: '2026-01-02T12:00:00.000Z',
        timeframe: '2m',
      },
    ],
  );
  for (const kind of ['obsidian', 'dropbox']) {
    const target = path.join(root, kind);
    await fs.mkdir(target);
    const job = { kind, folder: target, id: randomUUID(), source, status: 'pending', error: null };
    let called = false;
    const connector = createConnector(job, async () => {
      called = true;
    });
    const file = await connector.deliver(job);
    assert.equal(
      file,
      path.join(target, 'TradeFrame', path.basename(path.dirname(source)), 'setup.md'),
    );
    assert.deepEqual(await fs.readFile(file), await fs.readFile(source));
    assert.equal(called, false);
    assert.equal(
      connector.failureMessage(new Error('private detail')),
      'Could not sync. Check folder access, available space, and conflicting files, then retry.',
    );
  }
});

test('OneNote connector creation is inert and preserves the delivery promise, legacy notebook target and safe errors', async () => {
  for (const notebookId of [undefined, 'book']) {
    const job = {
      kind: 'onenote',
      id: randomUUID(),
      source: '/synthetic/setup.md',
      section: 'TradeFrame',
      ...(notebookId ? { notebookId } : {}),
      status: 'pending',
      error: null,
    };
    const calls = [];
    const completion = Promise.resolve();
    let receiver = 'not called';
    function deliver(source, section, id, notebookId) {
      'use strict';
      receiver = this;
      calls.push([source, section, id, notebookId]);
      return completion;
    }
    const connector = createConnector(job, deliver);
    assert.equal(calls.length, 0);
    assert.equal(connector.deliver(job), completion);
    assert.equal(receiver, undefined);
    assert.deepEqual(calls, [[job.source, 'TradeFrame', job.id, notebookId]]);
    assert.equal(
      connector.failureMessage(new OneNoteError('Synthetic safe error')),
      'Synthetic safe error',
    );
    assert.equal(
      connector.failureMessage(new Error('private token')),
      'Could not sync OneNote. Check your sign-in, connection and setup size, then retry.',
    );
    assert.throws(() => createConnector(job).deliver(job), { message: 'OneNote is not connected' });
  }
});

test('factory rejects unsupported destinations instead of silently treating them as folders', () => {
  assert.throws(() => createConnector({ kind: 'unknown' }), /Unsupported connector/);
});
