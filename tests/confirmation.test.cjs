const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

test('the app confirmation uses a modal outside hidden routes, defaults to keeping edits and restores focus', () => {
  const code = ts.transpileModule(fs.readFileSync('src/ConfirmDialog.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const answers = [],
    effects = [];
  let shown = 0,
    closed = 0,
    focused = 0,
    target;
  const body = {};
  const exports = {};
  vm.runInNewContext(code, {
    exports,
    document: { body, activeElement: { isConnected: true, focus: () => focused++ } },
    require: (name) => {
      if (name === 'react')
        return {
          useRef: () => ({ current: { showModal: () => shown++, close: () => closed++ } }),
          useEffect: (effect) => effects.push(effect),
        };
      if (name === 'react-dom')
        return {
          createPortal: (node, container) => {
            target = container;
            return node;
          },
        };
      return require(name);
    },
  });
  const dialog = exports.ConfirmDialog({
    message: 'Synthetic draft',
    onAnswer: (value) => answers.push(value),
  });
  const cleanup = effects[0]();
  assert.equal(target, body);
  assert.equal(shown, 1);
  assert.equal(dialog.type, 'dialog');
  assert.equal(dialog.props['aria-labelledby'], 'confirm-title');
  assert.equal(dialog.props['aria-describedby'], 'confirm-message');
  let prevented = false;
  dialog.props.onCancel({
    preventDefault: () => {
      prevented = true;
    },
  });
  assert.ok(prevented);
  assert.equal(answers.pop(), false);
  const [keep, replace] = dialog.props.children[3].props.children;
  assert.equal(keep.props.autoFocus, true);
  keep.props.onClick();
  replace.props.onClick();
  assert.deepEqual(answers, [false, true]);
  cleanup();
  assert.equal(closed, 1);
  assert.equal(focused, 1);
});
