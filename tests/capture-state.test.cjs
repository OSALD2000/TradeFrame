const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const compiled = ts.transpileModule(
  fs.readFileSync(path.join(__dirname, '../src/capture.ts'), 'utf8'),
  {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  },
).outputText;

function captureHook() {
  let resolve, reject, changed;
  let unsubscribed = 0;
  const initial = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  const cells = [];
  const cleanups = [];
  const api = {
    getState: () => initial,
    onStateChange: (listener) => {
      changed = listener;
      return () => {
        unsubscribed++;
      };
    },
  };
  const hooks = {
    useRef: (value) => ({ current: value }),
    useState: (value) => {
      const index = cells.length;
      cells.push(typeof value === 'function' ? value() : value);
      return [
        cells[index],
        (next) => {
          cells[index] = typeof next === 'function' ? next(cells[index]) : next;
        },
      ];
    },
    useEffect: (effect) => {
      cleanups.push(effect());
    },
  };
  const exports = {};
  vm.runInNewContext(compiled, {
    exports,
    require: (name) => {
      assert.equal(name, 'react');
      return hooks;
    },
    window: { capture: api },
  });
  const result = exports.useCapture();
  return {
    cells,
    result,
    resolve,
    reject,
    changed: (value) => changed(value),
    close: () => cleanups.forEach((cleanup) => cleanup()),
    unsubscribed: () => unsubscribed,
  };
}

test('an older initial capture reply cannot erase screenshots delivered by a newer native event', async () => {
  const hook = captureHook();
  const initial = hook.cells[0];
  const opened = {
    ...initial,
    screenshots: [{ id: 'cloud', image: 'tradeframe-image://capture/synthetic', timeframe: '2m' }],
  };
  hook.changed(opened);
  hook.resolve(initial);
  await new Promise(setImmediate);
  assert.equal(hook.cells[0], opened);
  hook.close();
  assert.equal(hook.unsubscribed(), 1);
});

test('the complete draft returned by open can restore screenshots even when a native event was missed', async () => {
  const hook = captureHook();
  const initial = hook.cells[0];
  const opened = {
    ...hook.cells[0],
    screenshots: [{ id: 'cloud', image: 'tradeframe-image://capture/synthetic', timeframe: '1m' }],
  };
  hook.result.restoreCapture(opened);
  hook.resolve(initial);
  await new Promise(setImmediate);
  assert.equal(hook.cells[0], opened);
  hook.close();
});

test('late capture replies and queued events do not update a disconnected renderer subscription', async () => {
  const hook = captureHook();
  const initial = hook.cells[0];
  hook.close();
  hook.changed({ ...initial, screenshots: [{ id: 'stale' }] });
  hook.reject(new Error('Synthetic late reply'));
  await new Promise(setImmediate);
  assert.equal(hook.cells[0], initial);
  assert.equal(hook.cells[1], null);
  assert.equal(hook.unsubscribed(), 1);
});
