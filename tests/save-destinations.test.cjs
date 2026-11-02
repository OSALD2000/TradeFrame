const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

test('an unavailable OneNote connection does not hide usable folder destinations or change selected choices', async () => {
  const cells = [],
    effects = [];
  const connections = { folders: { journal: null, obsidian: '/synthetic/vault', dropbox: null } };
  const selected = { journal: false, obsidian: true, dropbox: false, onenote: false };
  const exports = {};
  const hooks = {
    useState(initial) {
      const i = cells.length;
      cells.push(initial);
      return [
        initial,
        (value) => {
          cells[i] = value;
        },
      ];
    },
    useEffect(effect) {
      effects.push(effect);
    },
  };
  const code = ts.transpileModule(fs.readFileSync('src/SaveDestinations.tsx', 'utf8'), {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
  vm.runInNewContext(code, {
    exports,
    require: (name) =>
      name === 'react'
        ? hooks
        : name === '../electron/capture-types'
          ? require('../dist-electron/capture-types.js')
          : require(name),
  });
  exports.SaveDestinations({
    api: {
      getConnections: async () => connections,
      getOneNote: async () => {
        throw Error('Synthetic unavailable account');
      },
    },
    busy: false,
    visible: true,
    selected,
    onChange() {},
  });
  const cleanup = effects[0]();
  await new Promise(setImmediate);
  assert.equal(cells[0].connections, connections);
  assert.equal(cells[0].oneNote, null);
  assert.equal(cells[1], true);
  assert.deepEqual(selected, { journal: false, obsidian: true, dropbox: false, onenote: false });
  cleanup();
});
