const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const compiled = ts.transpileModule(
  fs.readFileSync(path.join(__dirname, '../src/OneNoteBrowser.tsx'), 'utf8'),
  {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  },
).outputText;

test('the OneNote browser lists only after connection and notebook selection', async () => {
  for (const state of [
    { connected: false, notebook: { displayName: 'Synthetic' } },
    { connected: true, notebook: null },
    { connected: true, notebook: { displayName: 'Synthetic' } },
  ]) {
    const cells = [];
    const effects = [];
    let lists = 0;
    const hooks = {
      useRef: () => ({ current: null }),
      useEffect: (effect) => effects.push(effect),
      useState: (value) => {
        const index = cells.length;
        cells.push(value);
        return [
          value,
          (next) => {
            cells[index] = next;
          },
        ];
      },
    };
    const exports = {};
    vm.runInNewContext(compiled, {
      exports,
      require: (name) => (name === 'react' ? hooks : require(name)),
    });
    exports.OneNoteBrowser({
      api: {
        getOneNote: async () => state,
        listOneNoteSetups: async () => {
          lists++;
          return [{ id: 'page', title: 'Synthetic' }];
        },
      },
      onClose() {},
      async onOpen() {},
    });
    effects.forEach((effect) => effect());
    await new Promise(setImmediate);
    const ready = state.connected && !!state.notebook;
    assert.equal(lists, ready ? 1 : 0);
    assert.equal(cells[2], false);
    if (ready) {
      assert.equal(cells[0][0].id, 'page');
      assert.equal(cells[4], '');
    } else {
      assert.equal(cells[0].length, 0);
      assert.match(cells[4], /Connections first/);
    }
  }
});
