const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const hookCode = ts.transpileModule(fs.readFileSync('src/useAreaSelection.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
const code = ts.transpileModule(fs.readFileSync('src/AreaSelection.tsx', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;

function mount(
  onSelect = async () => {},
  viewport = { left: 10, top: 20, width: 200, height: 150 },
) {
  let cursor = 0,
    tree,
    cancelled = 0,
    shown = 0,
    closed = 0,
    focus = 0;
  const cells = [],
    effects = [],
    cleanups = [];
  const node = {
    showModal: () => shown++,
    close: () => closed++,
    focus: () => focus++,
    setPointerCapture: () => {},
    getBoundingClientRect: () => viewport,
  };
  const hooks = {
    useRef: (initial) => {
      const i = cursor++;
      return (cells[i] ??= { current: initial });
    },
    useState: (initial) => {
      const i = cursor++;
      if (!(i in cells)) cells[i] = initial;
      return [
        cells[i],
        (value) => {
          cells[i] = value;
        },
      ];
    },
    useEffect: (effect, deps) => {
      const i = cursor++;
      const old = cells[i];
      if (!old || deps.some((d, j) => d !== old[j])) {
        effects.push(effect);
        cells[i] = deps;
      }
    },
  };
  const exports = {},
    hook = {};
  const document = { body: {}, activeElement: { isConnected: true, focus: () => focus++ } };
  vm.runInNewContext(hookCode, {
    exports: hook,
    document,
    require: (name) => (name === 'react' ? hooks : require(name)),
  });
  vm.runInNewContext(code, {
    exports,
    document: { body: {}, activeElement: { isConnected: true, focus: () => focus++ } },
    require: (name) =>
      name === './useAreaSelection'
        ? hook
        : name === 'react-dom'
          ? { createPortal: (element) => element }
          : require(name),
  });
  function find(type, element = tree) {
    if (!element || typeof element !== 'object') return null;
    if (element.type === type) return element;
    for (const child of [element.props?.children].flat(Infinity)) {
      const found = child ? find(type, child) : null;
      if (found) return found;
    }
    return null;
  }
  function render() {
    cursor = 0;
    tree = exports.AreaSelection({
      source: { image: 'tradeframe-image://capture/synthetic' },
      onSelect,
      onCancel: () => cancelled++,
    });
    find('dialog').props.ref.current = node;
    if (find('svg')) find('svg').props.ref.current = node;
    for (const effect of effects.splice(0)) {
      const cleanup = effect();
      if (cleanup) cleanups.push(cleanup);
    }
    return tree;
  }
  render();
  find('img').props.onLoad({ currentTarget: { naturalWidth: 400, naturalHeight: 300 } });
  render();
  const event = (clientX, clientY, extra = {}) => ({
    clientX,
    clientY,
    currentTarget: node,
    button: 0,
    isPrimary: true,
    pointerId: 1,
    preventDefault() {},
    ...extra,
  });
  return {
    find,
    render,
    event,
    exports: hook,
    cancelled: () => cancelled,
    shown: () => shown,
    closed: () => closed,
    focus: () => focus,
    close: () => cleanups.forEach((fn) => fn()),
  };
}

test('area geometry handles scaling, reverse drags and clipping without accepting clicks', () => {
  const {
    exports: { selectionRectangle: rectangle },
    close,
  } = mount();
  const plain = (value) => JSON.parse(JSON.stringify(value));
  assert.deepEqual(plain(rectangle({ x: 0.8, y: 0.9 }, { x: 0.1, y: 0.2 }, 400, 300)), {
    x: 40,
    y: 60,
    width: 280,
    height: 210,
  });
  assert.deepEqual(plain(rectangle({ x: -0.1, y: -0.2 }, { x: 1.2, y: 1.5 }, 400, 300)), {
    x: 0,
    y: 0,
    width: 400,
    height: 300,
  });
  assert.equal(rectangle({ x: 0.123, y: 0.456 }, { x: 0.123, y: 0.456 }, 400, 300), null);
  assert.equal(rectangle({ x: 0.1, y: 0.2 }, { x: 0.5, y: 0.2 }, 400, 300), null);
  close();
});

test('release directly commits only the selected pixels and ignores duplicate pointer events', async () => {
  const selected = [];
  const view = mount(async (rectangle) => selected.push(JSON.parse(JSON.stringify(rectangle))));
  view.find('svg').props.onPointerDown(view.event(60, 65));
  view.render();
  view.find('svg').props.onPointerMove(view.event(110, 95));
  view.render();
  view.find('svg').props.onPointerUp(view.event(110, 95));
  view.find('svg').props.onPointerUp(view.event(150, 100));
  await new Promise(setImmediate);
  assert.deepEqual(selected, [{ x: 100, y: 90, width: 100, height: 60 }]);
  assert.equal(view.shown(), 1);
  view.close();
  assert.equal(view.closed(), 1);
  assert.ok(view.focus() >= 2);
});

test('pointer cancellation, lost capture, right click and Escape never add an image', () => {
  const selected = [];
  const view = mount(async (rectangle) => selected.push(rectangle));
  for (const operation of ['onPointerCancel', 'onLostPointerCapture']) {
    view.find('svg').props.onPointerDown(view.event(60, 65));
    view.render();
    view.find('svg').props[operation]();
    view.render();
    view.find('svg').props.onPointerUp(view.event(110, 95));
  }
  view.find('svg').props.onPointerDown(view.event(60, 65, { button: 2 }));
  view.find('svg').props.onPointerUp(view.event(110, 95));
  view.find('dialog').props.onCancel({ preventDefault() {} });
  assert.equal(view.cancelled(), 1);
  assert.deepEqual(selected, []);
  view.close();
});

test('keyboard selection uses two corners and failed submissions remain editable', async () => {
  const selected = [];
  let fail = true;
  const view = mount(async (rectangle) => {
    if (fail) throw new Error('Synthetic failure');
    selected.push(JSON.parse(JSON.stringify(rectangle)));
  });
  const key = (key, shiftKey = false) => {
    view.find('svg').props.onKeyDown({ key, shiftKey, preventDefault() {} });
    view.render();
  };
  const select = () => {
    key('Enter');
    key('ArrowRight', true);
    key('ArrowDown', true);
    key('Enter');
  };
  select();
  await new Promise(setImmediate);
  view.render();
  assert.match(view.find('dialog').props.children.at(-1).props.children, /could not be added/);
  fail = false;
  select();
  await new Promise(setImmediate);
  assert.equal(selected.length, 1);
  assert.deepEqual(selected[0], { x: 110, y: 85, width: 10, height: 10 });
  view.close();
});

test('letterboxed images map to source pixels and padding clicks do not start a selection', async () => {
  const selected = [];
  const view = mount(async (value) => selected.push(JSON.parse(JSON.stringify(value))), {
    left: 10,
    top: 20,
    width: 400,
    height: 400,
  });
  view.find('svg').props.onPointerDown(view.event(60, 40));
  view.find('svg').props.onPointerUp(view.event(160, 220));
  assert.deepEqual(selected, []);
  view.find('svg').props.onPointerDown(view.event(60, 120));
  view.render();
  view.find('svg').props.onPointerMove(view.event(160, 220));
  view.render();
  assert.ok(view.find('rect'));
  view.find('svg').props.onPointerUp(view.event(160, 220));
  view.render();
  assert.equal(view.find('rect'), null, 'The selector is cleared before native export');
  await new Promise(setImmediate);
  assert.deepEqual(selected, [{ x: 50, y: 50, width: 100, height: 100 }]);
  view.close();
});
