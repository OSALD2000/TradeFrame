const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { DEFAULT_SCHEMA } = require('../dist-electron/form-schema.js');

// Compile the actual controls for server rendering without a DOM or native APIs.
const previous = { ts: require.extensions['.ts'], tsx: require.extensions['.tsx'] };
for (const extension of ['.ts', '.tsx'])
  require.extensions[extension] = (module, file) => {
    const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
        target: ts.ScriptTarget.ES2022,
      },
    });
    module._compile(compiled.outputText, file);
  };
const { FieldInput } = require('../src/FieldInput.tsx');
const { SchemaEditor } = require('../src/SchemaEditor.tsx');
const { ScreenshotFields } = require('../src/ScreenshotFields.tsx');
const {
  OneNoteApplicationSettings,
  OneNoteNotebookPicker,
} = require('../src/OneNoteConnection.tsx');
const { DeliveryStatus } = require('../src/DeliveryStatus.tsx');
const { DestinationSummary } = require('../src/SaveDestinations.tsx');
const { App, viewFromHash } = require('../src/App.tsx');
const { SetupForm } = require('../src/SetupForm.tsx');
const { FilingRules } = require('../src/FilingRules.tsx');
const { oneNoteMessage, oneNotePageTitle } = require('../src/OneNoteBrowser.tsx');
if (previous.ts) require.extensions['.ts'] = previous.ts;
else delete require.extensions['.ts'];
if (previous.tsx) require.extensions['.tsx'] = previous.tsx;
else delete require.extensions['.tsx'];

const field = (type, extra = {}) => ({
  id: 'test',
  key: 'test',
  label: 'Test',
  type,
  required: false,
  tags: [],
  ...extra,
});
const render = (definition, value) =>
  renderToStaticMarkup(
    React.createElement(FieldInput, { field: definition, value, onChange: () => {} }),
  );

test('OneNote opening keeps safe native diagnostics visible and hides raw network errors and delivery IDs', () => {
  const safe = 'OneNote could not download setup content (HTTP 403). Check notebook access.';
  assert.equal(
    oneNoteMessage(
      new Error(`Error invoking remote method 'onenote:open': Error: ${safe}`),
      'fallback',
    ),
    safe,
  );
  assert.equal(oneNoteMessage(new Error('private network details'), 'fallback'), 'fallback');
  assert.equal(oneNoteMessage(new Error('OneNote ' + 'x'.repeat(700)), 'fallback'), 'fallback');
  assert.equal(
    oneNotePageTitle('TradeFrame · TEST · 11111111-2222-3333-4444-555555555555'),
    'TEST',
  );
  assert.equal(oneNotePageTitle('My setup title'), 'My setup title');
});

test('workspace routes accept only known screens and leave in-page skip anchors alone', () => {
  assert.equal(viewFromHash('#journal'), 'journal');
  assert.equal(viewFromHash('#open'), 'open');
  assert.equal(viewFromHash('#connections'), 'connections');
  for (const hash of ['', '#workspace-content', '#save-title', '#unknown', 'javascript:alert(1)'])
    assert.equal(viewFromHash(hash), null);
});

test('workspace screens highlight the right navigation and include the draft form on every route', () => {
  const previousWindow = global.window;
  try {
    for (const screen of ['journal', 'open', 'connections', 'guide', 'statistics']) {
      global.window = { location: { hash: `#${screen}` }, capture: undefined };
      const markup = renderToStaticMarkup(React.createElement(App));
      assert.match(markup, new RegExp(`<a class="nav-item" href="#${screen}" aria-current="page"`));
      assert.equal((markup.match(/aria-current="page"/g) ?? []).length, 1);
      assert.match(markup, /<form class="setup-form"[^>]*aria-label="Setup details"/);
      assert.match(markup, /<details class="form-customization"><summary>Customize the form/);
      assert.match(markup, /Choose a local setup/);
      assert.match(markup, /Browse OneNote setups/);
      assert.match(markup, /Capture your first chart/);
      const journalTag = markup.match(/<section id="journal"[^>]*>/)[0];
      const openTag = markup.match(/<section id="open"[^>]*>/)[0];
      assert.equal(journalTag.includes('hidden'), screen !== 'journal');
      assert.equal(openTag.includes('hidden'), screen !== 'open');
      if (screen === 'guide') {
        for (const text of [
          'Your first setup',
          'Application (client) ID',
          'Notes.ReadWrite',
          'Allow public client flows',
        ])
          assert.ok(markup.includes(text), text);
      }
      if (screen === 'statistics') {
        assert.match(markup, /Coming soon/);
        assert.match(markup, /Statistics are not available in this release/);
        assert.doesNotMatch(markup, /Win rate|Total profit|0%/);
      }
    }
  } finally {
    if (previousWindow === undefined) delete global.window;
    else global.window = previousWindow;
  }
});

test('filing rule editor explains new-note scope and renders ordered accessible controls and a preview', () => {
  const markup = renderToStaticMarkup(
    React.createElement(FilingRules, { api: undefined, kind: 'obsidian', busy: false }),
  );
  assert.match(markup, /Existing notes keep their saved rules/);
  assert.match(markup, /Move Folder: Mode up/);
  assert.match(markup, /Remove File name: Market date/);
  assert.match(markup, /TradeFrame\/backtesting\/2026\/11\/01\/2026-11-01 0930 EURUSD Long FVG.md/);
  assert.match(markup, /Reset draft to defaults/);
});

test('destination review distinguishes an optional connection, a selected notebook and a session-only login from delivery', () => {
  const connections = {
    folders: { journal: '/synthetic/journal', obsidian: '/synthetic/vault', dropbox: null },
  };
  const notebook = { id: 'book', displayName: '<Selected book>', isDefault: false };
  const markup = renderToStaticMarkup(
    React.createElement(DestinationSummary, {
      connections,
      oneNote: { connected: true, durable: false, notebook },
    }),
  );
  assert.match(markup, /Required local copy/);
  assert.match(markup, /Notebook selected/);
  assert.match(markup, /&lt;Selected book&gt; \/ TradeFrame/);
  assert.match(markup, /Sign-in lasts this session only/);
  assert.doesNotMatch(markup, /Sent to your notebook|All destinations synced/);
  const disconnected = renderToStaticMarkup(
    React.createElement(DestinationSummary, {
      connections,
      oneNote: { connected: false, notebook },
    }),
  );
  assert.match(disconnected, /Sign in again/);
  assert.doesNotMatch(disconnected, /Notebook selected/);
});

test('open screen explains why a pending capture must be selected or canceled before replacing the draft', () => {
  const markup = renderToStaticMarkup(
    React.createElement(SetupForm, {
      api: undefined,
      busy: false,
      choosing: true,
      hasPreview: false,
      savedPath: null,
      timeframesReady: true,
      requiresTimeframeCopy: false,
      view: 'open',
      onOpened: () => {},
    }),
  );
  assert.match(markup, /Choose or cancel the pending screenshot selection/);
  assert.match(markup, /href="#journal">Create setup/);
  assert.match(markup, /Choose a local setup/);
  assert.match(markup, /Browse OneNote setups/);
});

test('save feedback separates local persistence from a failed OneNote upload and never claims all destinations synced', () => {
  const markup = renderToStaticMarkup(
    React.createElement(DeliveryStatus, {
      result: {
        status: 'saved',
        path: '/synthetic/<setup>.md',
        sync: [
          { id: '1', kind: 'obsidian', status: 'synced' },
          { id: '2', kind: 'onenote', status: 'failed', error: 'HTTP 403 <safe code>' },
        ],
      },
    }),
  );
  assert.match(markup, /Saved locally/);
  assert.match(markup, /Obsidian/);
  assert.match(markup, /Files saved/);
  assert.match(markup, /HTTP 403 &lt;safe code&gt;/);
  assert.doesNotMatch(markup, /All destinations synced|Sent to your notebook/);
  assert.match(markup, /Review connections and retry/);
  assert.match(markup, /&lt;setup&gt;/);
});

test('notebook picker shows the chosen notebook by ID and explains empty lists without a silent default', () => {
  const notebooks = [
    { id: 'a', displayName: '<Trading>', isDefault: true },
    { id: 'b', displayName: '<Trading>', isDefault: false },
  ];
  const props = {
    state: { notebook: notebooks[1], notebooks },
    disabled: false,
    onRefresh: async () => {},
    onSelect: async () => {},
  };
  const markup = renderToStaticMarkup(React.createElement(OneNoteNotebookPicker, props));
  assert.match(markup, /OneNote notebook/);
  assert.match(markup, /value="b" selected/);
  assert.match(markup, /&lt;Trading&gt;/);
  assert.doesNotMatch(markup, /<Trading>/);
  assert.match(markup, /Refresh notebooks/);
  assert.match(markup, /cancels pending OneNote deliveries/);
  const empty = renderToStaticMarkup(
    React.createElement(OneNoteNotebookPicker, {
      ...props,
      state: { notebook: null, notebooks: [] },
    }),
  );
  assert.match(empty, /<select[^>]*disabled/);
  assert.match(empty, /Create or open a notebook in OneNote first/);
});

test('configured OneNote IDs remain editable and removable after failed sign-in', () => {
  const markup = renderToStaticMarkup(
    React.createElement(OneNoteApplicationSettings, {
      state: {
        configured: true,
        applicationId: '11111111-2222-3333-4444-555555555555',
        customApplicationId: true,
        connected: false,
        error: 'Sign-in failed',
      },
      disabled: false,
      onConfigure: async () => {},
    }),
  );
  assert.match(markup, /<details[^>]*open=""/);
  assert.match(markup, /value="11111111-2222-3333-4444-555555555555"/);
  assert.match(markup, /Save application ID/);
  assert.match(markup, /type="button">Remove custom ID/);
  assert.match(markup, /App registrations/);
  assert.match(markup, /user\/object ID or directory\/tenant ID/);
});

test('publisher application settings stay available as optional advanced controls without requiring an ID for sign-in', () => {
  const markup = renderToStaticMarkup(
    React.createElement(OneNoteApplicationSettings, {
      state: {
        configured: true,
        applicationId: '11111111-2222-3333-4444-555555555555',
        customApplicationId: false,
        connected: false,
        error: null,
      },
      disabled: false,
      onConfigure: async () => {},
    }),
  );
  assert.match(markup, /Microsoft application ID · advanced settings/);
  assert.doesNotMatch(markup, /<details[^>]*open=/);
  assert.match(markup, /no app registration or application ID entry is needed/);
  assert.match(markup, /Save application ID/);
  assert.doesNotMatch(markup, /Remove custom ID/);
});

test('each screenshot has an independent required timeframe control and multiline notes', () => {
  const markup = renderToStaticMarkup(
    React.createElement(ScreenshotFields, {
      screenshot: { id: 'second', timeframe: '2m', caption: '<entry>' },
      busy: false,
      onTimeframe: () => {},
      onCaption: () => {},
    }),
  );
  assert.match(markup, /Timeframe \(required\)/);
  assert.match(markup, /list="timeframes-second" required=""/);
  assert.match(markup, /value="2m"/);
  assert.match(markup, /<option value="1m"/);
  assert.match(markup, /<option value="2m"/);
  assert.match(markup, /Screenshot notes \(optional\)/);
  assert.match(markup, /&lt;entry&gt;/);
  assert.match(markup, /<textarea rows="4" maxLength="20000"/);
});

test('rendered controls preserve false zero empty values and selected options', () => {
  assert.ok(!render(field('checkbox'), false).includes('checked'));
  assert.ok(render(field('checkbox'), true).includes('checked'));
  assert.ok(render(field('number'), 0).includes('value="0"'));
  assert.ok(render(field('number'), null).includes('value=""'));
  assert.ok(render(field('text'), '<script>').includes('&lt;script&gt;'));
  const multiple = render(
    field('multiselect', {
      options: [
        { value: 'a', label: 'Alpha', tags: [] },
        { value: 'b', label: 'Beta', tags: [] },
      ],
    }),
    ['b'],
  );
  assert.ok(multiple.includes('multiple'));
  assert.match(multiple, /value="b" selected/);
  assert.ok(render(field('datetime'), '2026-10-27T09:30').includes('type="datetime-local"'));
});

test('form editor exposes keys tags ordering options and dependencies without executing labels', () => {
  const markup = renderToStaticMarkup(
    React.createElement(SchemaEditor, {
      initial: { ...DEFAULT_SCHEMA, name: '<script>' },
      onSave: async () => {},
      onCancel: () => {},
    }),
  );
  for (const label of [
    'Markdown key',
    'Stored value',
    'Option tags',
    'Show this field when',
    'Add field',
    'Save form revision',
    'Required',
  ])
    assert.ok(markup.includes(label));
  assert.ok(markup.includes('&lt;script&gt;'));
  assert.ok(!markup.includes('<script>'));
});
