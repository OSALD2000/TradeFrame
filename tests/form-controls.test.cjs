const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { DEFAULT_SCHEMA } = require('../dist-electron/form-schema.js');

// Compile the actual controls for server rendering without a DOM or native APIs.
const previous = { ts: require.extensions['.ts'], tsx: require.extensions['.tsx'] };
for (const extension of ['.ts', '.tsx']) require.extensions[extension] = (module, file) => {
  const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022,
  } });
  module._compile(compiled.outputText, file);
};
const { FieldInput } = require('../src/FieldInput.tsx');
const { SchemaEditor } = require('../src/SchemaEditor.tsx');
const { ScreenshotFields } = require('../src/ScreenshotFields.tsx');
const { OneNoteApplicationSettings, OneNoteNotebookPicker } = require('../src/OneNoteConnection.tsx');
if (previous.ts) require.extensions['.ts'] = previous.ts; else delete require.extensions['.ts'];
if (previous.tsx) require.extensions['.tsx'] = previous.tsx; else delete require.extensions['.tsx'];

const field = (type, extra = {}) => ({ id: 'test', key: 'test', label: 'Test', type, required: false, tags: [], ...extra });
const render = (definition, value) => renderToStaticMarkup(React.createElement(FieldInput, { field: definition, value, onChange: () => {} }));

test('notebook picker shows the chosen notebook by ID and explains empty lists without a silent default', () => {
  const notebooks = [{ id: 'a', displayName: '<Trading>', isDefault: true }, { id: 'b', displayName: '<Trading>', isDefault: false }];
  const props = { state: { notebook: notebooks[1], notebooks }, disabled: false, onRefresh: async () => {}, onSelect: async () => {} };
  const markup = renderToStaticMarkup(React.createElement(OneNoteNotebookPicker, props));
  assert.match(markup, /OneNote notebook/);
  assert.match(markup, /value="b" selected/);
  assert.match(markup, /&lt;Trading&gt;/); assert.doesNotMatch(markup, /<Trading>/);
  assert.match(markup, /Refresh notebooks/);
  assert.match(markup, /cancels pending OneNote deliveries/);
  const empty = renderToStaticMarkup(React.createElement(OneNoteNotebookPicker, { ...props, state: { notebook: null, notebooks: [] } }));
  assert.match(empty, /<select[^>]*disabled/);
  assert.match(empty, /Create or open a notebook in OneNote first/);
});

test('configured OneNote IDs remain editable and removable after failed sign-in', () => {
  const markup = renderToStaticMarkup(React.createElement(OneNoteApplicationSettings, {
    state: { configured: true, applicationId: '11111111-2222-3333-4444-555555555555', customApplicationId: true,
      connected: false, error: 'Sign-in failed' }, disabled: false, onConfigure: async () => {},
  }));
  assert.match(markup, /<details[^>]*open=""/);
  assert.match(markup, /value="11111111-2222-3333-4444-555555555555"/);
  assert.match(markup, /Save application ID/);
  assert.match(markup, /type="button">Remove custom ID/);
  assert.match(markup, /App registrations/);
  assert.match(markup, /user\/object ID or directory\/tenant ID/);
});

test('each screenshot has an independent required timeframe control and multiline notes', () => {
  const markup = renderToStaticMarkup(React.createElement(ScreenshotFields, {
    screenshot: { id: 'second', timeframe: '2m', caption: '<entry>' }, busy: false, onTimeframe: () => {}, onCaption: () => {},
  }));
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
  const multiple = render(field('multiselect', { options: [{ value: 'a', label: 'Alpha', tags: [] }, { value: 'b', label: 'Beta', tags: [] }] }), ['b']);
  assert.ok(multiple.includes('multiple'));
  assert.match(multiple, /value="b" selected/);
  assert.ok(render(field('datetime'), '2026-10-27T09:30').includes('type="datetime-local"'));
});

test('form editor exposes keys tags ordering options and dependencies without executing labels', () => {
  const markup = renderToStaticMarkup(React.createElement(SchemaEditor, {
    initial: { ...DEFAULT_SCHEMA, name: '<script>' }, onSave: async () => {}, onCancel: () => {},
  }));
  for (const label of ['Markdown key', 'Stored value', 'Option tags', 'Show this field when', 'Add field', 'Save form revision', 'Required']) assert.ok(markup.includes(label));
  assert.ok(markup.includes('&lt;script&gt;'));
  assert.ok(!markup.includes('<script>'));
});
