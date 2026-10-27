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
if (previous.ts) require.extensions['.ts'] = previous.ts; else delete require.extensions['.ts'];
if (previous.tsx) require.extensions['.tsx'] = previous.tsx; else delete require.extensions['.tsx'];

const field = (type, extra = {}) => ({ id: 'test', key: 'test', label: 'Test', type, required: false, tags: [], ...extra });
const render = (definition, value) => renderToStaticMarkup(React.createElement(FieldInput, { field: definition, value, onChange: () => {} }));

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
