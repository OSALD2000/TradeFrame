const { test } = require('node:test');
const assert = require('node:assert/strict');
const { setupView } = require('./helpers/setup-view.cjs');
const { DEFAULT_SCHEMA } = require('../dist-electron/form-schema.js');

const answers = {
  mode: 'live',
  symbol: 'TEST',
  direction: 'long',
  model: 'Synthetic',
  timeframe: '5m',
  entryTimeNewYork: '',
  note: 'Original draft',
};
const capture = {
  barOpen: false,
  busy: false,
  sources: [],
  screenshots: [
    { id: 'synthetic', image: 'tradeframe-image://capture/synthetic', timeframe: '2m' },
  ],
  savedPath: null,
  requiresTimeframeCopy: false,
  error: null,
};
const loaded = { schema: DEFAULT_SCHEMA, values: answers, capture };
const saved = { status: 'saved', path: '/synthetic/setup.md', sync: [] };
async function fixture(t, overrides = {}, props = {}) {
  const calls = [];
  const api = {
    getSchemas: async () => [DEFAULT_SCHEMA],
    saveSetup: async (input, destinations) => {
      calls.push(['save', input, destinations]);
      return saved;
    },
    appendScreenshots: async (input, destinations) => {
      calls.push(['append', input, destinations]);
      return saved;
    },
    openSetup: async () => loaded,
    openOneNoteSetup: async () => loaded,
    newSetup: async () => {
      calls.push(['new']);
    },
    sendToOneNote: async () => saved,
    ...overrides,
  };
  const view = setupView(api, props);
  t.after(() => view.close());
  await view.flush();
  for (const [id, value] of Object.entries(answers)) view.field(id, value);
  return { view, api, calls };
}

test('setup save and append preserve the entered schema and values', async (t) => {
  const { view, calls } = await fixture(t);
  await view.submit();
  await view.submit(true);
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [
    [
      'save',
      { schema: DEFAULT_SCHEMA, values: answers },
      { journal: true, obsidian: false, dropbox: false, onenote: false },
    ],
    [
      'append',
      { schema: DEFAULT_SCHEMA, values: answers },
      { journal: true, obsidian: false, dropbox: false, onenote: false },
    ],
  ]);
  assert.equal(view.value('note'), answers.note);
});

test('setup save cancellation and failures preserve the draft and show the existing messages', async (t) => {
  const { view, api } = await fixture(t, { saveSetup: async () => ({ status: 'cancelled' }) });
  await view.submit();
  assert.ok(view.messages().includes('Save cancelled. Your draft is unchanged.'));
  api.saveSetup = async () => {
    throw new Error('Synthetic failure');
  };
  await view.submit();
  assert.ok(view.messages().some((message) => message.startsWith('Could not save.')));
  assert.equal(view.value('note'), answers.note);
});

test('setup save guards block missing timeframes and legacy append without issuing native commands', async (t) => {
  const { view, calls } = await fixture(t, {}, { timeframesReady: false });
  await view.submit();
  assert.equal(calls.length, 0);
  view.props.timeframesReady = true;
  view.props.requiresTimeframeCopy = true;
  view.render();
  await view.submit(true);
  assert.equal(calls.length, 0);
  await view.submit();
  assert.equal(calls[0][0], 'save');
});

test('new setup respects replacement cancellation and native failure before clearing entered values', async (t) => {
  const { view, api, calls } = await fixture(t);
  view.confirm(false);
  await view.click('Start a new setup');
  assert.equal(calls.length, 0);
  assert.equal(view.value('note'), answers.note);
  view.confirm(true);
  api.newSetup = async () => {
    throw new Error('Synthetic failure');
  };
  await view.click('Start a new setup');
  assert.equal(view.value('note'), answers.note);
  api.newSetup = async () => {
    calls.push(['new']);
  };
  await view.click('Start a new setup');
  assert.equal(view.value('note'), '');
  assert.ok(view.messages().includes('New setup ready.'));
});

test('local setup opening restores fields and screenshots together and preserves a draft on failure', async (t) => {
  const { view, api } = await fixture(t);
  view.field('note', 'Unsaved');
  await view.click('Choose a local setup…');
  assert.equal(view.value('note'), answers.note);
  assert.equal(view.opened[0], capture);
  api.openSetup = async () => {
    throw new Error('Synthetic failure');
  };
  view.field('note', 'Keep this');
  await view.click('Choose a local setup…');
  assert.equal(view.value('note'), 'Keep this');
  assert.equal(view.opened.length, 1);
});

test('a pending replacement waits for an explicit answer and cancels duplicate requests and unmounts', async (t) => {
  const { view, calls } = await fixture(t);
  const first = view.beginClick('Start a new setup');
  assert.equal(calls.length, 0);
  assert.equal(view.value('note'), answers.note);
  assert.match(view.find((n) => n.type.name === 'ConfirmDialog').props.message, /screenshots/);
  await view.beginClick('Start a new setup');
  assert.equal(calls.length, 0);
  view.answer(false);
  await first;
  await view.flush();
  assert.equal(view.value('note'), answers.note);
  const cancelledOnUnmount = view.beginClick('Start a new setup');
  view.close();
  await cancelledOnUnmount;
  assert.equal(calls.length, 0);
});

test('close and reload prompts preserve drafts on cancellation and unsubscribe on unmount', async (t) => {
  let request,
    removed = false;
  const replies = [];
  const { view } = await fixture(
    t,
    {
      onUnloadRequested: (listener) => {
        request = listener;
        return () => {
          removed = true;
        };
      },
      answerUnload: async (confirmed) => replies.push(confirmed),
    },
    { view: 'connections' },
  );
  request('close');
  view.render();
  assert.equal(view.find((n) => n.type.name === 'ConfirmDialog').props.action, 'close');
  assert.equal(replies.length, 0);
  view.answer(false);
  await view.flush();
  assert.deepEqual(replies, [false]);
  assert.equal(view.value('note'), answers.note);
  request('reload');
  view.render();
  assert.equal(view.find((n) => n.type.name === 'ConfirmDialog').props.action, 'reload');
  view.answer(true);
  await view.flush();
  assert.deepEqual(replies, [false, true]);
  view.close();
  assert.ok(removed);
});

test('OneNote selection requires screenshots before replacing fields or reporting an opened draft', async (t) => {
  const { view, api } = await fixture(t);
  await view.click('Browse OneNote setups…');
  let browser = view.find((n) => n.type.name === 'OneNoteBrowser');
  api.openOneNoteSetup = async () => ({ ...loaded, capture: { ...capture, screenshots: [] } });
  await assert.rejects(browser.props.onOpen('page'), /could not return screenshots/);
  assert.equal(view.opened.length, 0);
  assert.equal(view.value('note'), answers.note);
  api.openOneNoteSetup = async () => ({ ...loaded, legacy: true });
  await browser.props.onOpen('page');
  await view.flush();
  assert.equal(view.opened[0], capture);
  assert.ok(
    view.messages().some((message) => message.startsWith('Opened an older OneNote setup.')),
  );
});

test('form revisions preserve compatible values and clear changed types or removed choices', async (t) => {
  const revised = {
    ...DEFAULT_SCHEMA,
    revision: DEFAULT_SCHEMA.revision + 1,
    fields: DEFAULT_SCHEMA.fields.map((field) =>
      field.id === 'model'
        ? { ...field, type: 'number' }
        : field.id === 'direction'
          ? { ...field, options: field.options.filter((option) => option.value === 'short') }
          : field,
    ),
  };
  const { view, api } = await fixture(t, { saveSchema: async () => revised });
  await view.click('Edit form');
  let editor = view.find((n) => n.type.name === 'SchemaEditor');
  api.saveSchema = async () => {
    throw new Error('Synthetic failure');
  };
  await assert.rejects(editor.props.onSave(DEFAULT_SCHEMA), /Could not save the form/);
  assert.equal(view.find((n) => n.type.name === 'SchemaEditor').props.initial, DEFAULT_SCHEMA);
  api.saveSchema = async () => revised;
  await editor.props.onSave(revised);
  await view.flush();
  assert.equal(view.value('note'), answers.note);
  assert.equal(view.value('symbol'), answers.symbol);
  assert.equal(view.value('model'), null);
  assert.equal(view.value('direction'), '');
  assert.ok(view.messages().includes('Form revision saved.'));
});

test('sending a saved setup delegates to OneNote without saving another local copy', async (t) => {
  const sent = [];
  const { view, calls } = await fixture(
    t,
    {
      sendToOneNote: async () => {
        sent.push('send');
        return saved;
      },
    },
    { savedPath: saved.path },
  );
  await view.click('Send saved setup to OneNote');
  assert.deepEqual(sent, ['send']);
  assert.equal(calls.length, 0);
  assert.equal(view.value('note'), answers.note);
  assert.equal(view.find((n) => n.type.name === 'DeliveryStatus').props.result, saved);
});

test('destination choices are independent and reach both save and append without changing form values', async (t) => {
  const { view, calls } = await fixture(t);
  const change = (kind, value) => {
    view.find((node) => node.type.name === 'SaveDestinations').props.onChange(kind, value);
    view.render();
  };
  change('journal', false);
  change('onenote', true);
  await view.submit();
  await view.submit(true);
  for (const call of calls) {
    assert.deepEqual(JSON.parse(JSON.stringify(call[2])), {
      journal: false,
      obsidian: false,
      dropbox: false,
      onenote: true,
    });
  }
  assert.equal(view.value('note'), answers.note);
});

test('no selected destinations prevents submission while preserving fields and screenshots', async (t) => {
  const { view, calls } = await fixture(t);
  view.find((node) => node.type.name === 'SaveDestinations').props.onChange('journal', false);
  view.render();
  await view.submit();
  assert.deepEqual(calls, []);
  assert.ok(view.messages().includes('Choose at least one save destination'));
  assert.equal(view.value('note'), answers.note);
});
