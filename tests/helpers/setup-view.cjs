const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function setupView(api, options = {}, sources = {}) {
  const root = path.resolve(__dirname, '../..');
  const cells = [],
    pending = [],
    modules = new Map();
  let cursor = 0,
    tree,
    nextId = 0,
    confirmed = true;
  const opened = [];
  const props = {
    api,
    busy: false,
    choosing: false,
    hasPreview: true,
    savedPath: null,
    timeframesReady: true,
    requiresTimeframeCopy: false,
    view: 'journal',
    onOpened: (capture) => opened.push(capture),
    ...options,
  };
  const hooks = {
    useState(initial) {
      const index = cursor++;
      if (!(index in cells)) cells[index] = typeof initial === 'function' ? initial() : initial;
      return [
        cells[index],
        (next) => {
          cells[index] = typeof next === 'function' ? next(cells[index]) : next;
        },
      ];
    },
    useEffect(effect, deps) {
      const index = cursor++,
        previous = cells[index];
      if (!previous || deps.some((value, i) => !Object.is(value, previous.deps[i]))) {
        cells[index] = { deps, cleanup: previous?.cleanup };
        pending.push(() => {
          cells[index].cleanup?.();
          cells[index].cleanup = effect();
        });
      }
    },
    useRef(initial) {
      const index = cursor++;
      return (cells[index] ??= { current: initial });
    },
  };
  const window = { confirm: () => confirmed, addEventListener() {}, removeEventListener() {} };
  function load(file) {
    if (modules.has(file)) return modules.get(file);
    const exports = {};
    modules.set(file, exports);
    const code = ts.transpileModule(sources[file] ?? fs.readFileSync(file, 'utf8'), {
      fileName: file,
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText;
    vm.runInNewContext(
      code,
      {
        exports,
        window,
        Error,
        crypto: {
          randomUUID: () => `00000000-0000-4000-8000-${String(++nextId).padStart(12, '0')}`,
        },
        require(name) {
          if (name === 'react') return hooks;
          if (!name.startsWith('.')) return require(name);
          const target = path.resolve(path.dirname(file), name);
          if (target.startsWith(path.join(root, 'electron') + path.sep))
            return require(
              path.join(
                root,
                'dist-electron',
                path.relative(path.join(root, 'electron'), target) + '.js',
              ),
            );
          const resolved = [target + '.tsx', target + '.ts', target].find((p) => fs.existsSync(p));
          assert.ok(resolved, name);
          return load(resolved);
        },
      },
      { filename: file },
    );
    return exports;
  }
  const { SetupForm } = load(path.join(root, 'src/SetupForm.tsx'));
  function render() {
    cursor = 0;
    tree = SetupForm(props);
    while (pending.length) pending.shift()();
    return tree;
  }
  function nodes(node = tree, result = []) {
    function visit(value) {
      if (Array.isArray(value)) for (const child of value) visit(child);
      else if (value && typeof value === 'object' && value.props) {
        result.push(value);
        visit(value.props.children);
      }
    }
    visit(node);
    return result;
  }
  function find(predicate) {
    const node = nodes().find(predicate);
    assert.ok(node, 'Expected setup control');
    return node;
  }
  function text(node) {
    if (Array.isArray(node)) return node.map(text).join('');
    if (typeof node === 'string' || typeof node === 'number') return String(node);
    return node?.props ? text(node.props.children) : '';
  }
  async function flush() {
    for (let i = 0; i < 3; i++) {
      await new Promise(setImmediate);
      render();
    }
  }
  render();
  return {
    props,
    opened,
    render,
    flush,
    find,
    nodes,
    confirm(value) {
      confirmed = value;
    },
    async click(label) {
      await find(
        (n) => n.type === 'button' && text(n.props.children).replace(/\s+/g, ' ').trim() === label,
      ).props.onClick();
      await flush();
    },
    field(id, value) {
      find((n) => n.type.name === 'FieldInput' && n.props.field.id === id).props.onChange(value);
      render();
    },
    value(id) {
      return find((n) => n.type.name === 'FieldInput' && n.props.field.id === id).props.value;
    },
    async submit(append = false) {
      await find((n) => n.type === 'form').props.onSubmit({
        preventDefault() {},
        nativeEvent: { submitter: { getAttribute: () => (append ? 'append' : 'copy') } },
      });
      await flush();
    },
    messages() {
      return nodes()
        .filter((n) => ['status', 'alert'].includes(n.props.role))
        .map((n) => text(n.props.children));
    },
    close() {
      for (const cell of cells) cell?.cleanup?.();
    },
  };
}

module.exports = { setupView };
