const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { EventEmitter } = require('node:events');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const vm = require('node:vm');
const { image: syntheticImage, nativeImage } = require('./helpers/capture-image.cjs');
const dataRoots = [];
process.once('exit', () => {
  for (const root of dataRoots) require('node:fs').rmSync(root, { recursive: true, force: true });
});
const { DEFAULT_SCHEMA } = require('../dist-electron/form-schema.js');
const setupInput = (values = {}) => ({
  schema: DEFAULT_SCHEMA,
  values: {
    mode: 'live',
    direction: 'long',
    symbol: 'TEST',
    model: 'Test',
    timeframe: '5m',
    entryTimeNewYork: '',
    note: '',
    ...values,
  },
});

const source = (id, name = 'Synthetic chart') => ({
  id,
  name,
  thumbnail: {
    isEmpty: () => false,
    getScaleFactors: () => [1],
    toDataURL: () =>
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
  },
});

async function boot(
  capture = async () => [source('screen:0:0')],
  selectFolder = async () => ({ canceled: true, filePaths: [] }),
  primaryInstance = true,
  oneNoteOptions,
  runtime = {},
) {
  const fsSync = require('node:fs');
  const dataRoot = fsSync.mkdtempSync(
    path.join(require('node:os').tmpdir(), 'tradeframe-main-test-'),
  );
  dataRoots.push(dataRoot);
  const app = new EventEmitter();
  app.getPath = () => dataRoot;
  app.isPackaged = true;
  app.setName = () => {};
  app.requestSingleInstanceLock = () => primaryInstance;
  const switches = new Map(
    runtime.passwordStore === undefined ? [] : [['password-store', runtime.passwordStore]],
  );
  app.commandLine = {
    hasSwitch: (name) => switches.has(name),
    appendSwitch: (name, value) => switches.set(name, value),
  };
  app.whenReady = () => {
    app.readySwitches = new Map(switches);
    return Promise.resolve();
  };
  app.quit = () => {
    app.quitCalled = true;
  };
  const windows = [];
  const handlers = new Map();
  class BrowserWindow extends EventEmitter {
    static getAllWindows() {
      return windows.filter((w) => !w.destroyed);
    }
    constructor(options) {
      super();
      this.options = options;
      this.visible = false;
      this.opacity = 1;
      this.ignoreMouseEvents = false;
      this.position = [0, 0];
      this.webContents = new EventEmitter();
      this.webContents.mainFrame = { url: '' };
      this.webContents.setWindowOpenHandler = (handler) => {
        this.open = handler;
      };
      this.sent = [];
      this.webContents.send = (...args) => this.sent.push(args);
      windows.push(this);
    }
    loadFile(file, options) {
      this.file = file;
      this.webContents.mainFrame.url = pathToFileURL(file).href + (options ? '?view=capture' : '');
      return Promise.resolve();
    }
    show() {
      if (!this.visible) this.position = [0, 0];
      this.visible = true;
    }
    hide() {
      this.visible = false;
    }
    isFullScreen() {
      return !!this.fullscreen;
    }
    setFullScreen(value) {
      this.fullscreen = value;
    }
    focus() {
      this.focused = true;
    }
    setOpacity(value) {
      this.opacity = value;
    }
    setIgnoreMouseEvents(value) {
      this.ignoreMouseEvents = value;
    }
    isDestroyed() {
      return !!this.destroyed;
    }
    close() {
      this.emit('close');
      this.destroyed = true;
      this.emit('closed');
    }
  }
  const electron = {
    clipboard: runtime.clipboard ?? { has: async () => false, read: async () => [] },
    app,
    BrowserWindow,
    nativeImage: runtime.nativeImage ?? nativeImage,
    screen: {
      getAllDisplays: () =>
        runtime.displays ?? [{ size: { width: 1920, height: 1080 }, scaleFactor: 1 }],
    },
    protocol: {
      registerSchemesAsPrivileged: () => {},
      handle: (scheme, handler) => handlers.set(`protocol:${scheme}`, handler),
    },
    desktopCapturer: { getSources: (options) => capture(windows, options) },
    ipcMain: { handle: (name, fn) => handlers.set(name, fn) },
    dialog: {
      showErrorBox: () => assert.fail('Unexpected startup error'),
      showOpenDialog: selectFolder,
      showMessageBoxSync: () => {
        throw new Error('A system confirmation must not open');
      },
    },
    Menu: {
      buildFromTemplate: (template) => template,
      setApplicationMenu: (menu) => {
        app.applicationMenu = menu;
      },
    },
    shell: {
      openExternal: async (url) => {
        (app.openedHelp ??= []).push(url);
      },
    },
  };
  const dirname = path.resolve(__dirname, '../dist-electron');
  const intervals = new Map();
  let intervalId = 0;
  vm.runInNewContext(readFileSync(path.join(dirname, 'main.js'), 'utf8'), {
    exports: {},
    __dirname: dirname,
    process: { platform: runtime.platform ?? 'linux', env: runtime.env ?? {} },
    Buffer,
    Response,
    Uint8Array,
    setTimeout: (callback) => queueMicrotask(callback),
    setInterval: (callback) => {
      intervals.set(++intervalId, callback);
      return intervalId;
    },
    clearInterval: (id) => intervals.delete(id),
    require: (name) =>
      name === 'electron'
        ? electron
        : name === './schema-store'
          ? {
              SchemaStore: class extends require('../dist-electron/schema-store.js').SchemaStore {
                constructor() {
                  super(':memory:');
                }
              },
            }
          : name === './onenote' && oneNoteOptions
            ? {
                ...require('../dist-electron/onenote.js'),
                OneNoteClient: class extends require('../dist-electron/onenote.js').OneNoteClient {
                  constructor(directory, encryption, clientId) {
                    super(
                      directory,
                      encryption,
                      clientId,
                      oneNoteOptions.request,
                      oneNoteOptions.now,
                    );
                  }
                },
              }
            : require(name.startsWith('./') ? path.join(dirname, name) : name),
  });
  await new Promise(setImmediate);
  const invoke = async (name, window = windows[0], ...args) =>
    handlers.get(name)(
      {
        sender: window.webContents,
        senderFrame: window.webContents.mainFrame,
      },
      ...args,
    );
  return {
    app,
    windows,
    handlers,
    invoke,
    tick: () => Promise.all([...intervals.values()].map((callback) => callback())),
    intervalCount: () => intervals.size,
  };
}

async function captureReady(invoke, windows) {
  await invoke('capture:screenshot', windows[1]);
  for (const shot of (await invoke('capture:state')).screenshots) {
    if (!shot.timeframe) await invoke('capture:timeframe', windows[0], shot.id, '1m');
  }
}

test('startup loads only local UI with isolation and blocks navigation/new windows', async () => {
  const {
    app,
    windows: [window],
  } = await boot();
  assert.equal(window.file, path.resolve(__dirname, '../dist/index.html'));
  assert.equal(window.options.icon, path.resolve(__dirname, '../dist/tradeframe-icon.png'));
  assert.equal(window.options.autoHideMenuBar, true);
  assert.deepEqual(
    Array.from(app.applicationMenu, (item) => item.role),
    ['fileMenu', 'editMenu', 'viewMenu', 'windowMenu'],
  );
  assert.equal(window.visible, false);
  window.emit('ready-to-show');
  assert.equal(window.visible, true);
  assert.equal(window.open({ url: 'https://example.com' }).action, 'deny');
  let prevented = false;
  window.webContents.emit('will-navigate', {
    preventDefault: () => {
      prevented = true;
    },
  });
  assert.equal(prevented, true);
  assert.equal(window.options.webPreferences.nodeIntegration, false);
  assert.equal(window.options.webPreferences.contextIsolation, true);
  assert.equal(window.options.webPreferences.sandbox, true);
  assert.equal(
    window.options.webPreferences.preload,
    path.resolve(__dirname, '../dist-electron/preload.js'),
  );
  let discarded = false;
  window.webContents.emit('will-prevent-unload', {
    preventDefault: () => {
      discarded = true;
    },
  });
  assert.equal(discarded, false, 'The draft-close dialog keeps editing by default');
  app.emit('window-all-closed');
  assert.equal(app.quitCalled, true);
});

test('Sway chooses libsecret before Electron readiness and respects platform and explicit keyring overrides', async () => {
  for (const [runtime, expected] of [
    [{ env: { XDG_CURRENT_DESKTOP: 'sway:wlroots' } }, 'gnome-libsecret'],
    [{ env: { XDG_CURRENT_DESKTOP: 'SWAY' } }, 'gnome-libsecret'],
    [{ env: { XDG_CURRENT_DESKTOP: 'GNOME' } }, undefined],
    [{ env: { XDG_CURRENT_DESKTOP: 'sway' }, passwordStore: 'kwallet6' }, 'kwallet6'],
    [{ env: { XDG_CURRENT_DESKTOP: 'sway' }, passwordStore: 'basic' }, 'basic'],
    [{ env: { XDG_CURRENT_DESKTOP: 'sway' }, platform: 'darwin' }, undefined],
    [{ env: { XDG_CURRENT_DESKTOP: 'sway' }, platform: 'win32' }, undefined],
  ]) {
    const { app } = await boot(undefined, undefined, true, undefined, runtime);
    assert.equal(app.readySwitches.get('password-store'), expected);
  }
});

test('a second launch focuses the existing journal and a secondary process creates no windows or IPC handlers', async () => {
  const primary = await boot();
  primary.app.emit('second-instance');
  assert.equal(primary.windows[0].visible, true);
  assert.equal(primary.windows[0].focused, true);
  const secondary = await boot(undefined, undefined, false);
  assert.equal(secondary.app.quitCalled, true);
  assert.equal(secondary.windows.length, 0);
  assert.equal(secondary.handlers.size, 0);
});

test('capture excludes the journal and preserves the mapped bar position across screenshots', async () => {
  const { windows, invoke, app } = await boot(async (windows) => {
    assert.equal(windows[0].visible, false, 'The journal cannot obscure the selected chart');
    assert.equal(windows[1].visible, true, 'The bar stays mapped to preserve its position');
    assert.equal(windows[1].opacity, 0, 'The bar is transparent before capture');
    assert.equal(windows[1].ignoreMouseEvents, true);
    return [source('window:99:1', 'TradeFrame'), source('screen:0:0')];
  });
  windows[0].emit('ready-to-show');
  await invoke('capture:open-bar');
  const [journal, bar] = windows;
  assert.equal(bar.options.title, 'TradeFrame Capture');
  assert.equal(bar.options.frame, false);
  let titlePreserved = false;
  bar.emit('page-title-updated', {
    preventDefault: () => {
      titlePreserved = true;
    },
  });
  assert.equal(titlePreserved, true);
  assert.equal(bar.options.webPreferences.sandbox, true);
  assert.equal(bar.visible, true);
  assert.equal((await invoke('capture:state')).barOpen, true);
  assert.equal(journal.visible, true);
  bar.position = [280, 160];
  await invoke('capture:screenshot', bar);
  const state = await invoke('capture:state');
  assert.equal(state.screenshots.length, 1);
  assert.equal(state.sources.length, 0);
  assert.equal(state.busy, false);
  assert.equal(journal.visible, true);
  assert.equal(bar.visible, true);
  assert.deepEqual(bar.position, [280, 160]);
  assert.equal(bar.opacity, 1);
  assert.equal(bar.ignoreMouseEvents, false);
  app.emit('activate');
  assert.equal(bar.visible, true, 'Activating the app does not close the bar');
  await invoke('capture:screenshot', bar);
  assert.deepEqual(bar.position, [280, 160]);
  assert.equal(bar.visible, true, 'Repeated screenshots keep the bar open');
  await invoke('capture:journal');
  assert.equal(bar.visible, false, 'The journal can explicitly close the bar');
  assert.equal((await invoke('capture:state')).barOpen, false);
  await invoke('capture:open-bar');
  await invoke('capture:journal', bar);
  assert.equal(bar.visible, false, 'The bar can explicitly close itself');
  const shots = (await invoke('capture:state')).screenshots;
  for (const shot of shots) await invoke('capture:remove', journal, shot.id);
  assert.equal((await invoke('capture:state')).screenshots.length, 0);
  await invoke('capture:open-bar');
  assert.equal(journal.visible, true, 'Retaking keeps the journal visible');
  bar.close();
  assert.equal((await invoke('capture:state')).barOpen, false);
  assert.equal(journal.visible, true);
});

test('empty thumbnails restore the journal with an actionable error', async () => {
  const empty = source('screen:0:0');
  empty.thumbnail.isEmpty = () => true;
  const { windows, invoke } = await boot(async () => [empty]);
  await invoke('capture:open-bar');
  await captureReady(invoke, windows);
  const state = await invoke('capture:state');
  assert.equal(state.screenshots.length, 0);
  assert.equal(state.sources.length, 0);
  assert.match(state.error, /No screenshot/);
  assert.equal(windows[0].visible, true);
  assert.equal(windows[1].visible, true);
  assert.equal(windows[1].opacity, 1);
  assert.equal(windows[1].ignoreMouseEvents, false);
});

test('image URLs serve only current in-memory PNGs and state updates do not transmit image bytes', async () => {
  const { windows, handlers, invoke } = await boot();
  await invoke('capture:open-bar');
  await captureReady(invoke, windows);
  const state = await invoke('capture:state');
  const url = state.screenshots[0].image;
  assert.ok(JSON.stringify(state).length < 1000);
  assert.doesNotMatch(JSON.stringify(state), /data:image/);
  const serve = handlers.get('protocol:tradeframe-image');
  const response = serve({ method: 'GET', url });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Content-Type'), 'image/png');
  assert.deepEqual(
    Buffer.from(await response.arrayBuffer()).subarray(0, 8),
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  );
  for (const request of [
    { method: 'POST', url },
    { method: 'GET', url: 'tradeframe-image://capture/../../secrets' },
    { method: 'GET', url: `${url}?extra` },
  ]) {
    assert.equal(serve(request).status, 404);
  }
  await invoke('capture:remove', windows[0], state.screenshots[0].id);
  assert.equal(serve({ method: 'GET', url }).status, 404);
});

test('workspace hash navigation keeps native journal requests trusted without changing sender checks', async () => {
  const { windows, invoke } = await boot();
  const frame = windows[0].webContents.mainFrame;
  const original = frame.url;
  for (const view of ['journal', 'open', 'connections']) {
    frame.url = `${original}#${view}`;
    assert.equal((await invoke('connections:get')).version, 2);
    assert.equal((await invoke('onenote:state')).notebook, null);
  }
});

test('OneNote operations and login browser are unavailable to the capture bar', async () => {
  const { windows, invoke } = await boot();
  await invoke('capture:open-bar');
  for (const operation of [
    'state',
    'connect',
    'configure',
    'poll',
    'disconnect',
    'browser',
    'notebooks',
    'notebook',
    'setups',
    'open',
    'send',
  ]) {
    await assert.rejects(invoke(`onenote:${operation}`, windows[1]), /Untrusted/);
  }
  await assert.rejects(invoke('onenote:browser'), /Start OneNote sign-in/);
});

test('OneNote application ID reset uses trusted IPC and cancels only pending OneNote deliveries', async () => {
  const { app, windows, invoke } = await boot();
  const { ConnectionStore } = require('../dist-electron/connections.js');
  const store = new ConnectionStore(path.join(app.getPath(), 'connections.json'));
  store.setFolder('obsidian', app.getPath());
  store.enqueue(path.join(app.getPath(), 'synthetic.md'), 'TradeFrame');
  const configured = await invoke(
    'onenote:configure',
    windows[0],
    '11111111-2222-3333-4444-555555555555',
  );
  assert.equal(configured.customApplicationId, true);
  assert.deepEqual(
    Array.from((await invoke('connections:get')).jobs, (job) => job.kind),
    ['obsidian'],
  );
  const cleared = await invoke('onenote:configure', windows[0], '');
  assert.equal(cleared.applicationId, '');
  assert.equal(cleared.configured, false);
  assert.equal(cleared.connected, false);
});

test('native saves require a chosen notebook and switching it cancels failed jobs instead of redirecting them', async (t) => {
  const fs = require('node:fs/promises');
  const root = await fs.realpath(
    await fs.mkdtemp(path.join(require('node:os').tmpdir(), 'tradeframe-notebook-ipc-')),
  );
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  let now = 0;
  let fail = true;
  const destinations = [];
  const reply = (data, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
  const request = async (url, options) => {
    if (url.endsWith('devicecode'))
      return reply({ device_code: 'private-code', user_code: 'TEST', expires_in: 60, interval: 1 });
    if (url.endsWith('token')) return reply({ access_token: 'private-access', expires_in: 3600 });
    const pathname = new URL(url).pathname;
    if (pathname.endsWith('/notebooks'))
      return reply({
        value: ['book-a', 'book-b'].map((id) => ({
          id,
          displayName: id,
          isDefault: id === 'book-a',
        })),
      });
    if (pathname.endsWith('/sections'))
      return reply({
        value: [{ id: `sec-${pathname.split('/').at(-2)}`, displayName: 'TradeFrame' }],
      });
    assert.ok(pathname.includes('/sections/sec-book-'));
    if (options.method !== 'POST') return reply({ value: [] });
    destinations.push(pathname);
    return reply({}, fail ? 503 : 201);
  };
  const { windows, invoke } = await boot(
    undefined,
    async () => ({ canceled: false, filePaths: [root] }),
    true,
    { request, now: () => now },
  );
  await invoke('onenote:configure', windows[0], '11111111-2222-3333-4444-555555555555');
  await invoke('onenote:connect');
  now = 1000;
  await invoke('onenote:poll');
  await invoke('capture:open-bar');
  await captureReady(invoke, windows);
  assert.match(
    (
      await invoke('journal:save', windows[0], setupInput(), {
        journal: true,
        obsidian: false,
        dropbox: false,
        onenote: true,
      })
    ).warning,
    /choose a notebook/,
  );
  assert.equal((await invoke('connections:get')).jobs.length, 0);
  await invoke('onenote:notebooks');
  await assert.rejects(invoke('onenote:notebook', windows[0], 'unknown'), /available notebook/);
  await invoke('onenote:notebook', windows[0], 'book-b');
  const failed = await invoke('journal:save', windows[0], setupInput(), {
    journal: true,
    obsidian: false,
    dropbox: false,
    onenote: true,
  });
  assert.equal(failed.sync[0].status, 'failed');
  assert.equal(failed.sync[0].notebookId, 'book-b');
  await invoke('onenote:notebook', windows[0], 'book-a');
  assert.equal((await invoke('connections:get')).jobs.length, 0);
  fail = false;
  const sent = await invoke('journal:save', windows[0], setupInput(), {
    journal: true,
    obsidian: false,
    dropbox: false,
    onenote: true,
  });
  assert.equal(sent.sync[0].status, 'synced');
  assert.equal(sent.sync[0].notebookId, 'book-a');
  assert.deepEqual(destinations, [
    '/v1.0/me/onenote/sections/sec-book-b/pages',
    '/v1.0/me/onenote/sections/sec-book-a/pages',
  ]);
});

test('native save requires an explicitly chosen timeframe for every screenshot', async () => {
  let dialogs = 0;
  const { windows, invoke } = await boot(undefined, async () => {
    dialogs++;
    return { canceled: true, filePaths: [] };
  });
  await invoke('capture:open-bar');
  await invoke('capture:screenshot', windows[1]);
  await invoke('capture:screenshot', windows[1]);
  const shots = (await invoke('capture:state')).screenshots;
  assert.deepEqual(
    Array.from(shots, (shot) => shot.timeframe),
    ['', ''],
  );
  await assert.rejects(invoke('capture:timeframe', windows[1], shots[0].id, '1m'), /Untrusted/);
  for (const value of [null, '100000m', '1m\n'])
    await assert.rejects(invoke('capture:timeframe', windows[0], shots[0].id, value), /Invalid/);
  await assert.rejects(invoke('capture:timeframe', windows[0], 'unknown', '1m'), /Invalid/);
  await invoke('capture:timeframe', windows[0], shots[0].id, '1');
  await assert.rejects(invoke('journal:save', windows[0], setupInput()), /timeframe/);
  await invoke('capture:timeframe', windows[0], shots[0].id, '1m');
  await assert.rejects(invoke('journal:save', windows[0], setupInput()), /timeframe/);
  assert.equal(dialogs, 0, 'Validation precedes the folder picker');
  await invoke('capture:timeframe', windows[0], shots[1].id, '2m');
  assert.deepEqual(
    Array.from((await invoke('capture:state')).screenshots, (shot) => shot.timeframe),
    ['1m', '2m'],
  );
  assert.equal((await invoke('journal:save', windows[0], setupInput())).status, 'cancelled');
  assert.equal(dialogs, 1);
});

test('repeated captures append distinct screenshots and validate caption/removal commands', async () => {
  const { windows, invoke } = await boot();
  await invoke('capture:open-bar');
  for (let i = 0; i < 20; i++) await captureReady(invoke, windows);
  const shots = (await invoke('capture:state')).screenshots;
  assert.equal(shots.length, 20);
  assert.equal(new Set(shots.map((shot) => shot.id)).size, 20);
  await captureReady(invoke, windows);
  assert.equal((await invoke('capture:state')).screenshots.length, 20);
  assert.match((await invoke('capture:state')).error, /20 screenshots/);
  await assert.rejects(
    invoke('capture:caption', windows[1], shots[0].id, 'Wrong window'),
    /Untrusted/,
  );
  await assert.rejects(
    invoke('capture:caption', windows[0], shots[0].id, 'x'.repeat(20001)),
    /Invalid/,
  );
  await assert.rejects(invoke('capture:remove', windows[0], 'missing'), /Invalid/);
  await invoke('capture:caption', windows[0], shots[0].id, '5m entry');
  assert.equal((await invoke('capture:state')).screenshots[0].caption, '5m entry');
  await invoke('capture:remove', windows[0], shots[1].id);
  assert.equal((await invoke('capture:state')).screenshots.length, 19);
  await captureReady(invoke, windows);
  assert.equal((await invoke('capture:state')).screenshots.length, 20);
  await assert.rejects(invoke('journal:new', windows[1]), /Untrusted/);
  await invoke('journal:new');
  assert.equal((await invoke('capture:state')).screenshots.length, 0);
});

test('source selection rejects stale ids and cancellation keeps the previous preview', async () => {
  let count = 0;
  const { windows, invoke } = await boot(async () =>
    ++count === 1 ? [source('screen:0:0')] : [source('screen:0:0'), source('window:42:0')],
  );
  await invoke('capture:open-bar');
  await captureReady(invoke, windows);
  await invoke('capture:open-bar');
  await captureReady(invoke, windows);
  assert.equal((await invoke('capture:state')).sources.length, 2);
  await assert.rejects(
    invoke('capture:choose', windows[0], 'window:unknown:0'),
    /no longer available/,
  );
  await assert.rejects(invoke('capture:choose', windows[0], { id: 'screen:0:0' }), /Invalid/);
  await invoke('capture:discard');
  assert.equal((await invoke('capture:state')).screenshots.length, 1);
  await invoke('capture:open-bar');
  await captureReady(invoke, windows);
  await invoke('capture:choose', windows[0], 'window:42:0');
  assert.equal((await invoke('capture:state')).screenshots.length, 2);
  assert.equal(windows[1].visible, true, 'Selecting a snapshot keeps the bar open');
});

test('permission failure restores the journal and preserves an earlier screenshot', async () => {
  let count = 0;
  const { windows, invoke } = await boot(async () => {
    if (++count > 1) throw new Error('synthetic denial');
    return [source('screen:0:0')];
  });
  await invoke('capture:open-bar');
  await captureReady(invoke, windows);
  await invoke('capture:open-bar');
  await captureReady(invoke, windows);
  const state = await invoke('capture:state');
  assert.equal(state.screenshots.length, 1);
  assert.match(state.error, /cancelled or screen access/);
  assert.equal(state.busy, false);
  assert.equal(windows[0].visible, true);
  assert.equal(windows[1].visible, true);
  assert.equal(windows[1].opacity, 1);
  assert.equal(windows[1].ignoreMouseEvents, false);
});

test('IPC rejects unknown windows, subframes and remote pages', async () => {
  const { windows, handlers, invoke } = await boot();
  const journal = windows[0];
  const state = handlers.get('capture:state');
  assert.throws(() => state({ sender: {}, senderFrame: {} }), /Untrusted/);
  assert.throws(() => state({ sender: journal.webContents, senderFrame: {} }), /Untrusted/);
  const url = journal.webContents.mainFrame.url;
  journal.webContents.mainFrame.url = 'https://example.com';
  assert.throws(
    () => state({ sender: journal.webContents, senderFrame: journal.webContents.mainFrame }),
    /Untrusted/,
  );
  journal.webContents.mainFrame.url = url;
  await assert.rejects(invoke('capture:screenshot'), /Untrusted/);
  await invoke('capture:open-bar');
  await assert.rejects(invoke('capture:choose', windows[1], 'screen:0:0'), /Untrusted/);
});

test('duplicate capture requests do not start parallel captures', async () => {
  let resolve;
  let calls = 0;
  const { windows, invoke } = await boot(() => {
    calls++;
    return new Promise((done) => {
      resolve = done;
    });
  });
  await invoke('capture:open-bar');
  const first = invoke('capture:screenshot', windows[1]);
  await new Promise(setImmediate);
  await captureReady(invoke, windows);
  assert.equal(calls, 1);
  resolve([source('screen:0:0')]);
  await first;
});

test('closing the journal during capture drops the pending image', async () => {
  let resolve;
  const { windows, invoke, app } = await boot(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  await invoke('capture:open-bar');
  const pending = invoke('capture:screenshot', windows[1]);
  await new Promise(setImmediate);
  windows[0].close();
  app.emit('activate');
  resolve([source('screen:0:0')]);
  await pending;
  assert.equal((await invoke('capture:state', windows[2])).screenshots.length, 0);
});

test('preload exposes named commands and strips event objects from subscriptions', () => {
  const ipcRenderer = new EventEmitter();
  const calls = [];
  ipcRenderer.invoke = (...args) => {
    calls.push(args);
    return Promise.resolve();
  };
  let api;
  vm.runInNewContext(readFileSync(path.resolve(__dirname, '../dist-electron/preload.js'), 'utf8'), {
    exports: {},
    require: () => ({
      ipcRenderer,
      contextBridge: {
        exposeInMainWorld: (_name, value) => {
          api = value;
        },
      },
    }),
  });
  api.chooseSource('screen:0:0');
  assert.deepEqual(calls[0], ['capture:choose', 'screen:0:0']);
  assert.equal(api.invoke, undefined);
  api.saveSetup({ symbol: 'Synthetic' });
  assert.deepEqual(calls[1], ['journal:save', { symbol: 'Synthetic' }, undefined]);
  api.getSchemas();
  api.saveSchema(DEFAULT_SCHEMA);
  api.openSetup();
  assert.deepEqual(calls.slice(2), [
    ['forms:list'],
    ['forms:save', DEFAULT_SCHEMA],
    ['journal:open'],
  ]);
  api.setAutoCapture(true);
  api.editScreenshot('synthetic');
  assert.deepEqual(calls.slice(-2), [
    ['capture:auto', true],
    ['capture:edit', 'synthetic'],
  ]);
  const received = [];
  const unsubscribe = api.onStateChange((...args) => received.push(args));
  const state = { preview: null };
  ipcRenderer.emit('capture:changed', { sender: 'privileged event' }, state);
  assert.deepEqual(received, [[state]]);
  assert.equal(unsubscribe(), undefined);
  assert.equal(ipcRenderer.listenerCount('capture:changed'), 0);
  const unloads = [];
  const stopUnload = api.onUnloadRequested((...args) => unloads.push(args));
  ipcRenderer.emit('journal:unload-requested', { sender: 'privileged event' }, 'close');
  ipcRenderer.emit('journal:unload-requested', {}, 'reload');
  ipcRenderer.emit('journal:unload-requested', {}, 'unknown');
  assert.deepEqual(unloads, [['close'], ['reload']]);
  assert.equal(stopUnload(), undefined);
  assert.equal(ipcRenderer.listenerCount('journal:unload-requested'), 0);
  api.answerUnload(false);
  assert.deepEqual(calls.at(-1), ['journal:answer-unload', false]);
});

test('saving requires a journal screenshot and cancellation preserves it while blocking parallel capture', async () => {
  let resolve, prompted;
  const shown = new Promise((done) => {
    prompted = done;
  });
  const { windows, invoke } = await boot(
    undefined,
    () =>
      new Promise((done) => {
        resolve = done;
        prompted();
      }),
  );
  const input = setupInput();
  await assert.rejects(invoke('journal:save', windows[0], input), /Choose a screenshot/);
  await invoke('capture:open-bar');
  await captureReady(invoke, windows);
  await assert.rejects(invoke('journal:save', windows[1], input), /Untrusted/);
  await assert.rejects(invoke('journal:save', windows[0], setupInput({ symbol: '' })), /Symbol/);
  const pending = invoke('journal:save', windows[0], input);
  assert.equal((await invoke('capture:state')).busy, true);
  await assert.rejects(invoke('journal:save', windows[0], input), /Choose a screenshot/);
  await invoke('capture:discard');
  await shown;
  resolve({ canceled: true, filePaths: [] });
  assert.equal((await pending).status, 'cancelled');
  assert.equal((await invoke('capture:state')).screenshots.length, 1);
  assert.equal((await invoke('capture:state')).busy, false);
});

test('save failures preserve the preview and unlock the controls for retry', async () => {
  const { windows, invoke } = await boot(undefined, async () => {
    throw new Error('Synthetic folder failure');
  });
  await invoke('capture:open-bar');
  await captureReady(invoke, windows);
  await assert.rejects(
    invoke('journal:save', windows[0], setupInput({ mode: 'backtest', direction: 'short' })),
    /Could not save/,
  );
  assert.equal((await invoke('capture:state')).screenshots.length, 1);
  assert.equal((await invoke('capture:state')).busy, false);
});

test('journal save resolves a selected folder alias and writes the native snapshot', async (t) => {
  const fs = require('node:fs/promises');
  const root = await fs.realpath(
    await fs.mkdtemp(path.join(require('node:os').tmpdir(), 'tradeframe-ipc-')),
  );
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const folder = path.join(root, 'journal');
  const alias = path.join(root, 'journal-alias');
  await fs.mkdir(folder);
  await fs.symlink(folder, alias, process.platform === 'win32' ? 'junction' : 'dir');
  const image =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
  const snapshot = source('screen:0:0');
  snapshot.thumbnail.toDataURL = () => image;
  const { windows, invoke } = await boot(
    async () => [snapshot],
    async (owner, options) => {
      assert.equal(owner, windows[0]);
      assert.ok(options.properties.includes('openDirectory'));
      return { canceled: false, filePaths: [alias] };
    },
  );
  await invoke('capture:open-bar');
  await captureReady(invoke, windows);
  const saved = await invoke('journal:save', windows[0], setupInput({ note: 'Synthetic' }));
  assert.equal(saved.status, 'saved');
  assert.equal(path.dirname(path.dirname(saved.path)), folder);
  assert.equal((await invoke('connections:get')).folders.journal, folder);
  assert.match(await fs.readFile(saved.path, 'utf8'), /Synthetic/);
  assert.equal(
    (await fs.readFile(path.join(path.dirname(saved.path), 'chart.png'))).toString('base64'),
    image.split(',')[1],
  );
  assert.equal((await invoke('capture:state')).busy, false);
});

test('schema commands validate the journal sender and preserve previous revisions', async () => {
  const { windows, invoke, app } = await boot();
  const initial = (await invoke('forms:list'))[0];
  await invoke('capture:open-bar');
  await assert.rejects(invoke('forms:list', windows[1]), /Untrusted/);
  await assert.rejects(invoke('forms:save', windows[1], initial), /Untrusted/);
  await assert.rejects(invoke('journal:open', windows[1]), /Untrusted/);
  const saved = await invoke('forms:save', windows[0], { ...initial, name: 'Custom review' });
  assert.equal(saved.revision, 2);
  await assert.rejects(invoke('forms:save', windows[0], initial), /changed/);
  assert.equal((await invoke('forms:list'))[0].name, 'Custom review');
  app.emit('will-quit');
});

test('native journal save uses the historical day and preserves multiline screenshot notes', async (t) => {
  const fs = require('node:fs/promises');
  const root = await fs.realpath(
    await fs.mkdtemp(path.join(require('node:os').tmpdir(), 'tradeframe-calendar-ipc-')),
  );
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const { windows, invoke } = await boot(undefined, async () => ({
    canceled: false,
    filePaths: [root],
  }));
  const schema = (await invoke('forms:list')).find((item) => item.id === 'journal');
  assert.ok(schema, 'New template is available alongside the original');
  await invoke('capture:open-bar');
  await captureReady(invoke, windows);
  const shot = (await invoke('capture:state')).screenshots[0];
  const caption = 'First paragraph\n\n' + 'A'.repeat(400);
  await invoke('capture:caption', windows[0], shot.id, caption);
  const saved = await invoke('journal:save', windows[0], {
    schema,
    values: {
      mode: 'backtest',
      date: '2025-01-07',
      time_ny: '09:30',
      session: 'NY AM',
      symbol: 'TEST',
      direction: 'notrade',
      model: 'Example',
      result: 'notrade',
      r: null,
    },
  });
  assert.equal(
    path.relative(root, saved.path).split(path.sep).join('/'),
    'backtesting/2025/01/07/2025-01-07 0930 TEST No Trade Example.md',
  );
  assert.equal(
    (await require('../dist-electron/journal.js').readSetup(saved.path)).screenshots[0].caption,
    caption,
  );
});

test('opening a setup restores its schema values and image without modifying the source', async (t) => {
  const fs = require('node:fs/promises');
  const root = await fs.mkdtemp(path.join(require('node:os').tmpdir(), 'tradeframe-open-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const image =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
  const file = await require('../dist-electron/journal.js').writeSetup(
    root,
    setupInput({ note: 'Restore 🕯' }),
    [
      {
        id: 'test',
        image,
        caption: 'Entry',
        capturedAt: '2026-10-30T12:00:00.000Z',
        timeframe: '1m',
      },
    ],
  );
  const original = await fs.readFile(file, 'utf8');
  const { windows, invoke, app } = await boot(undefined, async (_, options) => {
    assert.ok(options.properties.includes('openFile'));
    return { canceled: false, filePaths: [file] };
  });
  const opened = await invoke('journal:open');
  assert.equal(opened.values.note, 'Restore 🕯');
  assert.equal(opened.schema.revision, 1);
  assert.deepEqual(opened.capture, await invoke('capture:state'));
  assert.equal(opened.capture.screenshots.length, 1);
  assert.match(
    (await invoke('capture:state')).screenshots[0].image,
    /^tradeframe-image:\/\/capture\//,
  );
  assert.equal((await invoke('capture:state')).busy, false);
  assert.equal(await fs.readFile(file, 'utf8'), original);
  assert.equal((await invoke('forms:list')).length, 2);
  app.emit('will-quit');
});

test('legacy opening requires a separate timeframe copy and enables appending only after saving it', async (t) => {
  const fs = require('node:fs/promises');
  const { serializeSetup } = require('../dist-electron/form-schema.js');
  const root = await fs.mkdtemp(path.join(require('node:os').tmpdir(), 'tradeframe-legacy-copy-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const file = path.join(root, 'old.md');
  const input = setupInput();
  const original = serializeSetup({
    ...input,
    schemaVersion: 3,
    createdAt: '2026-10-30T12:00:00.000Z',
    screenshots: [{ file: 'chart.png', caption: 'Legacy', capturedAt: '2026-10-30T12:00:00.000Z' }],
  });
  await fs.writeFile(file, original);
  await fs.writeFile(
    path.join(root, 'chart.png'),
    Buffer.from(source('synthetic').thumbnail.toDataURL().split(',')[1], 'base64'),
  );
  const { windows, invoke } = await boot(undefined, async (_, options) => ({
    canceled: false,
    filePaths: [options.properties.includes('openFile') ? file : root],
  }));
  await invoke('journal:open');
  let state = await invoke('capture:state');
  assert.equal(state.requiresTimeframeCopy, true);
  assert.equal(state.screenshots[0].timeframe, '');
  await invoke('capture:timeframe', windows[0], state.screenshots[0].id, '2m');
  await assert.rejects(invoke('journal:append', windows[0], input), /Could not append/);
  const copy = await invoke('journal:save', windows[0], input);
  assert.notEqual(copy.path, file);
  state = await invoke('capture:state');
  assert.equal(state.requiresTimeframeCopy, false);
  assert.equal(state.savedPath, copy.path);
  await invoke('capture:open-bar');
  await captureReady(invoke, windows);
  assert.equal((await invoke('journal:append', windows[0], input)).path, copy.path);
  assert.equal(await fs.readFile(file, 'utf8'), original);
});

test('folder connections are journal-only and save sends all screenshots to both targets', async (t) => {
  const fs = require('node:fs/promises');
  const root = await fs.realpath(
    await fs.mkdtemp(path.join(require('node:os').tmpdir(), 'tradeframe-destinations-')),
  );
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const folders = ['obsidian', 'dropbox', 'journal'].map((name) => path.join(root, name));
  for (const folder of folders) await fs.mkdir(folder);
  let selections = 0;
  const snapshot = source('screen:0:0');
  snapshot.thumbnail.toDataURL = () =>
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
  const { windows, invoke } = await boot(
    async () => [snapshot],
    async () => ({ canceled: false, filePaths: [folders[selections++]] }),
  );
  await invoke('capture:open-bar');
  await assert.rejects(invoke('connections:folder', windows[1], 'dropbox'), /Untrusted/);
  await assert.rejects(invoke('connections:folder', windows[0], 'arbitrary'), /Invalid/);
  await invoke('connections:folder', windows[0], 'obsidian');
  await invoke('connections:folder', windows[0], 'dropbox');
  for (let i = 0; i < 2; i++) await captureReady(invoke, windows);
  const saved = await invoke('journal:save', windows[0], setupInput(), {
    journal: true,
    obsidian: true,
    dropbox: true,
    onenote: false,
  });
  assert.equal(saved.sync.length, 2);
  assert.ok(saved.sync.every((job) => job.status === 'synced'));
  assert.equal((await invoke('connections:get')).folders.journal, folders[2]);
  await captureReady(invoke, windows);
  const appended = await invoke('journal:append', windows[0], setupInput(), {
    journal: true,
    obsidian: true,
    dropbox: true,
    onenote: false,
  });
  assert.equal(appended.path, saved.path);
  assert.equal(
    (await require('../dist-electron/journal.js').readSetup(saved.path)).screenshots.length,
    3,
  );
  assert.ok(appended.sync.every((job) => job.status === 'synced'));
  await invoke('journal:save', windows[0], setupInput(), {
    journal: true,
    obsidian: true,
    dropbox: true,
    onenote: false,
  });
  assert.equal(selections, 3, 'Saving again uses the remembered journal folder');
  for (const folder of folders.slice(0, 2))
    assert.equal((await fs.readdir(path.join(folder, 'TradeFrame'))).length, 2);
});

test('saved setups can be sent after connecting and cloud opens restore a separate draft without touching files', async (t) => {
  const fs = require('node:fs/promises');
  const root = await fs.realpath(
    await fs.mkdtemp(path.join(require('node:os').tmpdir(), 'tradeframe-cloud-ipc-')),
  );
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  let now = 0;
  let title;
  let html;
  let snapshot;
  let png;
  let corrupt = false;
  const reply = (data, status = 200) => new Response(JSON.stringify(data), { status });
  const graph = 'https://graph.microsoft.com/v1.0/me/onenote/';
  const request = async (url, options) => {
    if (url.endsWith('devicecode'))
      return reply({ device_code: 'private', user_code: 'TEST', expires_in: 60, interval: 1 });
    if (url.endsWith('token')) return reply({ access_token: 'private-access', expires_in: 3600 });
    const resource = new URL(url).pathname;
    if (resource.endsWith('/notebooks'))
      return reply({ value: [{ id: 'book', displayName: 'Synthetic book', isDefault: false }] });
    if (resource.endsWith('/sections'))
      return reply({ value: [{ id: 'section', displayName: 'TradeFrame' }] });
    if (resource.endsWith('/resources/setup/content')) return new Response(snapshot);
    if (resource.endsWith('/resources/chart0/content'))
      return new Response(corrupt ? Buffer.from('invalid PNG') : png);
    if (resource.endsWith('/content')) return new Response(html);
    if (options.method !== 'POST') return reply({ value: title ? [{ id: 'page', title }] : [] });
    html = await options.body.get('Presentation').text();
    title = /<title>(.*?)<\/title>/.exec(html)[1];
    snapshot = await options.body.get('setup').text();
    png = Buffer.from(await options.body.get('chart0').arrayBuffer());
    html = html
      .replace('data="name:setup"', `data="${graph}resources/setup/$value"`)
      .replace('src="name:chart0"', `data-fullres-src="${graph}resources/chart0/$value"`);
    return reply({ id: 'page' }, 201);
  };
  const { windows, invoke } = await boot(
    undefined,
    async () => ({ canceled: false, filePaths: [root] }),
    true,
    { request, now: () => now },
  );
  await invoke('connections:folder', windows[0], 'obsidian');
  await invoke('capture:open-bar');
  await captureReady(invoke, windows);
  const saved = await invoke('journal:save', windows[0], setupInput(), {
    journal: true,
    obsidian: true,
    dropbox: false,
    onenote: false,
  });
  const original = await fs.readFile(saved.path);
  assert.equal(saved.sync.length, 1);
  assert.equal(saved.sync[0].kind, 'obsidian');
  await invoke('onenote:configure', windows[0], '11111111-2222-3333-4444-555555555555');
  await invoke('onenote:connect');
  now = 1000;
  await invoke('onenote:poll');
  await invoke('onenote:notebooks');
  await invoke('onenote:notebook', windows[0], 'book');
  const sent = await invoke('onenote:send');
  assert.equal(sent.sync.length, 1);
  assert.equal(sent.sync[0].kind, 'onenote');
  assert.equal(sent.sync[0].status, 'synced');
  assert.equal((await invoke('connections:get')).jobs.length, 2);
  await invoke('onenote:setups');
  const before = await invoke('capture:state');
  await assert.rejects(invoke('onenote:open', windows[0], 'unknown'), /choose a page/);
  assert.deepEqual(await invoke('capture:state'), before);
  corrupt = true;
  await assert.rejects(invoke('onenote:open', windows[0], 'page'), /OneNote could not finish/);
  assert.deepEqual(await invoke('capture:state'), before);
  corrupt = false;
  const loaded = await invoke('onenote:open', windows[0], 'page');
  assert.deepEqual(loaded.values, setupInput().values);
  assert.equal(loaded.legacy, false);
  const state = await invoke('capture:state');
  assert.equal(state.savedPath, null);
  assert.equal(state.screenshots.length, 1);
  assert.deepEqual(loaded.capture, state);
  assert.equal(loaded.capture.busy, false);
  assert.ok(state.screenshots[0].image.startsWith('tradeframe-image:'));
  assert.deepEqual(await fs.readFile(saved.path), original);
  await assert.rejects(invoke('journal:append', windows[0], setupInput()), /Could not append/);
});

test('setup help opens only named official pages from the journal window', async () => {
  const { app, windows, invoke } = await boot();
  await invoke('guide:open', windows[0], 'entra');
  await invoke('guide:open', windows[0], 'notebooks');
  assert.deepEqual(app.openedHelp, [
    'https://entra.microsoft.com/',
    'https://onenote.cloud.microsoft/notebooks',
  ]);
  for (const topic of ['javascript:alert(1)', 'file:///private', '__proto__', null])
    await assert.rejects(invoke('guide:open', windows[0], topic), /Invalid help page/);
  await invoke('capture:open-bar');
  await assert.rejects(invoke('guide:open', windows[1], 'entra'));
  assert.equal(app.openedHelp.length, 2);
});

test('native close and reload remain blocked until the trusted journal answers the pending confirmation', async () => {
  const { app, windows, invoke } = await boot();
  const window = windows[0];
  let allowed = 0,
    closes = 0,
    reloads = 0;
  const attempt = () =>
    window.webContents.emit('will-prevent-unload', {
      preventDefault: () => allowed++,
    });
  await assert.rejects(invoke('journal:answer-unload', window, true), /No pending/);
  window.emit('close');
  attempt();
  attempt();
  assert.equal(allowed, 0);
  assert.equal(window.sent.filter(([name]) => name === 'journal:unload-requested').length, 1);
  assert.equal(window.sent.at(-1)[1], 'close');
  await assert.rejects(invoke('journal:answer-unload', window, 'yes'), /Invalid/);
  await invoke('capture:open-bar');
  await assert.rejects(invoke('journal:answer-unload', windows[1], true));
  await invoke('journal:answer-unload', window, false);
  assert.equal(window.destroyed, undefined);
  window.close = () => {
    closes++;
    window.emit('close');
    attempt();
  };
  window.webContents.reload = () => {
    reloads++;
    attempt();
  };
  window.emit('close');
  attempt();
  await invoke('journal:answer-unload', window, true);
  assert.equal(closes, 1);
  assert.equal(allowed, 1);
  await assert.rejects(invoke('journal:answer-unload', window, true), /No pending/);
  attempt();
  assert.equal(allowed, 1, 'Approval is consumed exactly once');
  assert.equal(window.sent.at(-1)[1], 'reload');
  await invoke('journal:answer-unload', window, true);
  assert.equal(reloads, 1);
  assert.equal(allowed, 2);
  app.emit('before-quit');
  attempt();
  await invoke('journal:answer-unload', window, false);
  assert.equal(app.quitCalled, undefined);
  app.emit('before-quit');
  attempt();
  await invoke('journal:answer-unload', window, true);
  assert.equal(app.quitCalled, true);
});

test('native filing preferences validate changes and new saves retain all destination rules', async (t) => {
  const fs = require('node:fs/promises');
  const root = await fs.realpath(
    await fs.mkdtemp(path.join(require('node:os').tmpdir(), 'tradeframe-filing-ipc-')),
  );
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const { windows, invoke } = await boot(undefined, async () => ({
    canceled: false,
    filePaths: [root],
  }));
  const original = await invoke('filing:get');
  const rule = {
    ...original.obsidian,
    root: 'Trading',
    folders: ['instrument', 'year'],
    name: ['date', 'instrument'],
  };
  await invoke('filing:set', windows[0], 'obsidian', rule);
  await assert.rejects(
    invoke('filing:set', windows[0], 'obsidian', { ...rule, root: '../outside' }),
  );
  assert.equal((await invoke('filing:get')).obsidian.root, 'Trading');
  await invoke('capture:open-bar');
  await assert.rejects(invoke('filing:get', windows[1]));
  await captureReady(invoke, windows);
  const { JOURNAL_SCHEMA, deserializeSetup } = require('../dist-electron/form-schema');
  const result = await invoke('journal:save', windows[0], {
    schema: JOURNAL_SCHEMA,
    values: {
      mode: 'backtest',
      date: '2025-01-07',
      time_ny: '',
      session: '',
      symbol: 'TEST',
      direction: 'long',
      model: 'Example',
      d_bias: '',
      result: 'pending',
      r: null,
      note: '',
    },
  });
  assert.equal(result.status, 'saved');
  const saved = deserializeSetup(await fs.readFile(result.path, 'utf8'));
  assert.equal(saved.schemaVersion, 6);
  assert.deepEqual(saved.filing.obsidian, rule);
});

test('automatic chart capture saves only cropped PNG pixels without an approval step', async (t) => {
  const { mkdtemp, rm } = require('node:fs/promises');
  const folder = await mkdtemp(path.join(require('node:os').tmpdir(), 'tradeframe-cropped-'));
  t.after(() => rm(folder, { recursive: true, force: true }));
  const full = syntheticImage(400, 300, (x, y) =>
    x >= 25 && x < 345 && y >= 35 && y < 265 ? [19, 23, 34, 255] : [40, 40, 40, 255],
  );
  const expected = full.crop({ x: 25, y: 35, width: 320, height: 230 }).png;
  const { invoke, windows, handlers } = await boot(
    async () => [{ ...source('screen:0:0'), thumbnail: full }],
    async () => ({ canceled: false, filePaths: [folder] }),
  );
  await invoke('capture:open-bar');
  await captureReady(invoke, windows);
  const state = await invoke('capture:state');
  assert.equal(state.areaSource, null);
  assert.equal(state.sources.length, 0);
  assert.equal(state.screenshots.length, 1);
  assert.equal(state.screenshots[0].crop, 'chart');
  const response = await handlers.get('protocol:tradeframe-image')({
    method: 'GET',
    url: state.screenshots[0].image,
  });
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), expected);
  const saved = await invoke('journal:save', windows[0], setupInput());
  const loaded = await require('../dist-electron/journal.js').readSetup(saved.path);
  assert.deepEqual(
    require('../dist-electron/journal.js').pngBytes(loaded.screenshots[0].image),
    expected,
  );
});

test('area selection validates the source and rectangle, preserves cancellation and never auto-crops small selections', async () => {
  const full = syntheticImage(400, 300, (x, y) => [x % 256, y % 256, 30, 255]);
  const { invoke, windows, handlers } = await boot(async () => [
    { ...source('screen:0:0'), thumbnail: full },
  ]);
  await invoke('capture:open-bar');
  await invoke('capture:screenshot', windows[1], 'chart');
  const previous = (await invoke('capture:state')).screenshots[0];
  await invoke('capture:screenshot', windows[1], 'area');
  let state = await invoke('capture:state');
  const pending = state.areaSource;
  assert.equal(windows[1].opacity, 0);
  assert.equal(windows[1].ignoreMouseEvents, true);
  assert.equal(state.screenshots.length, 1);
  await assert.rejects(invoke('capture:screenshot', windows[1], 'invalid'), /Invalid capture mode/);
  await assert.rejects(invoke('capture:screenshot', windows[1], 'area'), /Finish or cancel/);
  const rectangle = { x: 15, y: 12, width: 9, height: 6 };
  await assert.rejects(invoke('capture:area', windows[1], pending.image, rectangle), /Untrusted/);
  await assert.rejects(
    invoke('capture:area', windows[0], 'tradeframe-image://capture/stale', rectangle),
    /no longer/,
  );
  await assert.rejects(
    invoke('capture:area', windows[0], pending.image, { x: 399, y: 12, width: 9, height: 6 }),
    /Invalid capture area/,
  );
  await assert.rejects(invoke('journal:save', windows[0], setupInput()), /Choose a screenshot/);
  assert.equal((await invoke('capture:state')).areaSource, pending);
  await invoke('capture:discard');
  assert.equal(windows[1].opacity, 1);
  assert.equal(windows[1].ignoreMouseEvents, false);
  assert.equal((await invoke('capture:state')).screenshots[0], previous);
  assert.equal(
    (await handlers.get('protocol:tradeframe-image')({ method: 'GET', url: pending.image })).status,
    404,
  );
  await invoke('capture:screenshot', windows[1], 'area');
  state = await invoke('capture:state');
  const current = state.areaSource;
  await invoke('capture:area', windows[0], current.image, rectangle);
  state = await invoke('capture:state');
  assert.equal(state.areaSource, null);
  assert.equal(state.screenshots.length, 2);
  assert.equal(state.screenshots[0], previous);
  assert.equal(state.screenshots[1].crop, 'area');
  const response = await handlers.get('protocol:tradeframe-image')({
    method: 'GET',
    url: state.screenshots[1].image,
  });
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), full.crop(rectangle).png);
  await assert.rejects(invoke('capture:area', windows[0], current.image, rectangle), /no longer/);
});

test('multiple source area capture chooses the original image before selecting a rectangle', async () => {
  const full = syntheticImage(60, 40, () => [100, 100, 100, 255]);
  const { invoke, windows } = await boot(async () =>
    ['screen:0:0', 'window:2:0'].map((id) => ({ ...source(id), thumbnail: full })),
  );
  await invoke('capture:open-bar');
  await invoke('capture:screenshot', windows[1], 'area');
  assert.equal((await invoke('capture:state')).sources.length, 2);
  await invoke('capture:choose', windows[0], 'window:2:0');
  const state = await invoke('capture:state');
  assert.equal(state.areaSource.id, 'window:2:0');
  assert.equal(state.sources.length, 0);
  assert.equal(state.screenshots.length, 0);
  await invoke('journal:new');
  assert.equal((await invoke('capture:state')).areaSource, null);
});

test('a detection failure keeps the original PNG and failed area cropping preserves pending and earlier images', async () => {
  const full = syntheticImage(60, 40, () => [19, 23, 34, 255]);
  const originalBitmap = full.toBitmap,
    originalCrop = full.crop;
  full.toBitmap = () => {
    throw new Error('Synthetic bitmap failure');
  };
  const { invoke, windows, handlers } = await boot(async () => [
    { ...source('screen:0:0'), thumbnail: full },
  ]);
  try {
    await invoke('capture:open-bar');
    await invoke('capture:screenshot', windows[1], 'chart');
    const prior = (await invoke('capture:state')).screenshots[0];
    assert.equal(prior.crop, 'full');
    const response = await handlers.get('protocol:tradeframe-image')({
      method: 'GET',
      url: prior.image,
    });
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), full.png);
    await invoke('capture:screenshot', windows[1], 'area');
    const pending = (await invoke('capture:state')).areaSource;
    full.crop = () => {
      throw new Error('Synthetic crop failure');
    };
    await assert.rejects(
      invoke('capture:area', windows[0], pending.image, { x: 0, y: 0, width: 1, height: 1 }),
      /Synthetic crop failure/,
    );
    const state = await invoke('capture:state');
    assert.equal(state.areaSource, pending);
    assert.equal(state.screenshots[0], prior);
  } finally {
    full.toBitmap = originalBitmap;
    full.crop = originalCrop;
  }
});

test('capture requests physical display resolution and preserves the highest available native image representation', async () => {
  const full = syntheticImage(400, 300, (x, y) => [x % 256, y % 256, 70, 255]);
  const reduced = syntheticImage(200, 150, () => [70, 70, 70, 255]);
  let chosenScale;
  const thumbnail = {
    ...full,
    getScaleFactors: () => [1, 2],
    toDataURL: (options) => {
      chosenScale = options.scaleFactor;
      return (chosenScale === 2 ? full : reduced).toDataURL();
    },
  };
  const { invoke, windows, handlers } = await boot(
    async (windows, options) => {
      assert.equal(windows[0].visible, false);
      assert.deepEqual(JSON.parse(JSON.stringify(options.thumbnailSize)), {
        width: 3840,
        height: 2160,
      });
      return [{ ...source('screen:0:0'), thumbnail }];
    },
    undefined,
    true,
    undefined,
    {
      displays: [
        { size: { width: 1920, height: 1080 }, scaleFactor: 2 },
        { size: { width: 1280, height: 720 }, scaleFactor: 1 },
      ],
    },
  );
  await invoke('capture:open-bar');
  await invoke('capture:screenshot', windows[1], 'area');
  assert.equal(chosenScale, 2);
  const pending = (await invoke('capture:state')).areaSource;
  const response = await handlers.get('protocol:tradeframe-image')({
    method: 'GET',
    url: pending.image,
  });
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), full.png);
  await invoke('capture:area', windows[0], pending.image, { x: 0, y: 0, width: 400, height: 300 });
  const shot = (await invoke('capture:state')).screenshots[0];
  const exported = await handlers.get('protocol:tradeframe-image')({
    method: 'GET',
    url: shot.image,
  });
  assert.deepEqual(Buffer.from(await exported.arrayBuffer()), full.png);
});

test('area capture restores the preceding full-screen state on commit and cancellation', async () => {
  const full = syntheticImage(60, 40, () => [19, 23, 34, 255]);
  const { invoke, windows } = await boot(async () => [
    { ...source('screen:0:0'), thumbnail: full },
  ]);
  await invoke('capture:open-bar');
  await invoke('capture:screenshot', windows[1], 'area');
  assert.equal(windows[0].fullscreen, true);
  const pending = (await invoke('capture:state')).areaSource;
  await invoke('capture:area', windows[0], pending.image, { x: 0, y: 0, width: 10, height: 10 });
  assert.equal(windows[0].fullscreen, false);
  windows[0].fullscreen = true;
  await invoke('capture:screenshot', windows[1], 'area');
  await invoke('capture:discard');
  assert.equal(windows[0].fullscreen, true);
});

test('cancelling area capture before an asynchronous full-screen entry still exits full-screen', async () => {
  const full = syntheticImage(60, 40, () => [19, 23, 34, 255]);
  const { invoke, windows } = await boot(async () => [
    { ...source('screen:0:0'), thumbnail: full },
  ]);
  await invoke('capture:open-bar');
  await invoke('capture:screenshot', windows[1], 'area');
  await invoke('capture:discard');
  windows[0].fullscreen = true;
  windows[0].emit('enter-full-screen');
  assert.equal(windows[0].fullscreen, false);
  windows[0].emit('leave-full-screen');
});

const chosenDestinations = (...kinds) =>
  Object.fromEntries(
    ['journal', 'obsidian', 'dropbox', 'onenote'].map((kind) => [kind, kinds.includes(kind)]),
  );
async function destinationFixture(t, note = false, journalFolder = true) {
  const fs = require('node:fs/promises');
  const root = await fs.realpath(
    await fs.mkdtemp(path.join(require('node:os').tmpdir(), 'tradeframe-choice-')),
  );
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const folders = Object.fromEntries(
    ['obsidian', 'dropbox', 'journal'].map((kind) => [kind, path.join(root, kind)]),
  );
  for (const folder of Object.values(folders)) await fs.mkdir(folder);
  const choices = [folders.obsidian, folders.dropbox, ...(journalFolder ? [folders.journal] : [])];
  let dialogs = 0,
    now = 0,
    posts = 0;
  const reply = (data) =>
    new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
  const request = async (url, options) => {
    if (url.endsWith('devicecode'))
      return reply({ device_code: 'synthetic', user_code: 'TEST', expires_in: 60, interval: 1 });
    if (url.endsWith('token')) return reply({ access_token: 'synthetic', expires_in: 3600 });
    if (url.includes('/notebooks?'))
      return reply({ value: [{ id: 'book', displayName: 'Synthetic', isDefault: true }] });
    if (url.includes('/sections?'))
      return reply({ value: [{ id: 'section', displayName: 'TradeFrame' }] });
    if (options.method === 'POST') {
      posts++;
      return reply({ id: 'page' });
    }
    return reply({ value: [] });
  };
  const runtime = await boot(
    undefined,
    async () => {
      assert.ok(dialogs < choices.length, 'No unexpected journal picker');
      return { canceled: false, filePaths: [choices[dialogs++]] };
    },
    true,
    note ? { request, now: () => now } : undefined,
  );
  for (const kind of ['obsidian', 'dropbox', ...(journalFolder ? ['journal'] : [])])
    await runtime.invoke('connections:folder', runtime.windows[0], kind);
  if (note) {
    await runtime.invoke(
      'onenote:configure',
      runtime.windows[0],
      '11111111-2222-3333-4444-555555555555',
    );
    await runtime.invoke('onenote:connect');
    now = 1000;
    await runtime.invoke('onenote:poll');
    await runtime.invoke('onenote:notebooks');
    await runtime.invoke('onenote:notebook', runtime.windows[0], 'book');
  }
  await runtime.invoke('capture:open-bar');
  await captureReady(runtime.invoke, runtime.windows);
  return {
    ...runtime,
    profile: await fs.realpath(runtime.app.getPath()),
    root,
    folders,
    dialogs: () => dialogs,
    posts: () => posts,
  };
}

test('every nonempty destination combination creates only explicitly selected delivery jobs', async (t) => {
  const f = await destinationFixture(t, true);
  const kinds = ['journal', 'obsidian', 'dropbox', 'onenote'];
  for (let mask = 1; mask < 16; mask++) {
    const selected = Object.fromEntries(kinds.map((kind, i) => [kind, !!(mask & (1 << i))]));
    const result = await f.invoke('journal:save', f.windows[0], setupInput(), selected);
    assert.equal(result.localJournal, selected.journal);
    assert.deepEqual(
      result.sync.map((job) => job.kind),
      kinds.slice(1).filter((kind) => selected[kind]),
    );
    assert.ok(result.sync.every((job) => job.status === 'synced'));
    assert.equal(result.path.startsWith(f.folders.journal + path.sep), selected.journal);
    if (!selected.journal)
      assert.ok(result.path.startsWith(path.join(f.profile, 'saved-setups') + path.sep));
  }
  assert.equal(f.posts(), 8);
});

test('empty or malformed destination selections are rejected before writing or scheduling anything', async (t) => {
  const f = await destinationFixture(t);
  const fs = require('node:fs/promises');
  for (const selected of [
    chosenDestinations(),
    {},
    [],
    null,
    { ...chosenDestinations('journal'), extra: true },
    { ...chosenDestinations('journal'), onenote: 'yes' },
  ])
    await assert.rejects(
      f.invoke('journal:save', f.windows[0], setupInput(), selected),
      /destinations|at least one/,
    );
  assert.equal((await f.invoke('capture:state')).savedPath, null);
  assert.deepEqual((await f.invoke('connections:get')).jobs, []);
  assert.deepEqual(await fs.readdir(f.folders.journal), []);
});

test('local-only default ignores connected folders and an unusable unselected OneNote configuration', async (t) => {
  const f = await destinationFixture(t);
  const fs = require('node:fs/promises');
  await fs.writeFile(path.join(f.app.getPath(), 'onenote.json'), 'invalid json');
  const result = await f.invoke('journal:save', f.windows[0], setupInput());
  assert.equal(result.localJournal, true);
  assert.equal(result.warning, undefined);
  assert.deepEqual(result.sync, []);
  for (const folder of [f.folders.obsidian, f.folders.dropbox])
    assert.deepEqual(await fs.readdir(folder), []);
});

test('Obsidian-only save skips the journal picker and retains a private source for safe follow-ups', async (t) => {
  const f = await destinationFixture(t, false, false);
  const fs = require('node:fs/promises');
  const result = await f.invoke(
    'journal:save',
    f.windows[0],
    setupInput(),
    chosenDestinations('obsidian'),
  );
  assert.equal(result.localJournal, false);
  assert.equal(f.dialogs(), 2);
  assert.equal((await f.invoke('connections:get')).folders.journal, null);
  assert.equal(result.sync[0].kind, 'obsidian');
  assert.equal(result.sync[0].status, 'synced');
  assert.deepEqual(await fs.readdir(f.folders.journal), []);
  if (process.platform !== 'win32')
    assert.equal((await fs.stat(path.join(f.app.getPath(), 'saved-setups'))).mode & 0o777, 0o700);
  const { readSetup } = require('../dist-electron/journal.js');
  assert.equal((await readSetup(result.path)).screenshots.length, 1);
});

test('deselecting local journal while appending preserves the original note and validates edits before branching', async (t) => {
  const f = await destinationFixture(t);
  const fs = require('node:fs/promises');
  const first = await f.invoke('journal:save', f.windows[0], setupInput());
  const before = await fs.readFile(first.path);
  await captureReady(f.invoke, f.windows);
  await assert.rejects(
    f.invoke(
      'journal:append',
      f.windows[0],
      setupInput({ note: 'changed' }),
      chosenDestinations('obsidian'),
    ),
    /Could not append/,
  );
  assert.deepEqual(await fs.readFile(first.path), before);
  assert.deepEqual(await fs.readdir(path.join(f.app.getPath(), 'saved-setups')), []);
  const appended = await f.invoke(
    'journal:append',
    f.windows[0],
    setupInput(),
    chosenDestinations('obsidian'),
  );
  assert.equal(appended.localJournal, false);
  assert.notEqual(appended.path, first.path);
  assert.deepEqual(await fs.readFile(first.path), before);
  assert.equal(
    (await require('../dist-electron/journal.js').readSetup(appended.path)).screenshots.length,
    2,
  );
  assert.deepEqual(
    appended.sync.map((job) => job.kind),
    ['obsidian'],
  );
});

test('selecting local journal after a private save creates a local copy without changing the private source or unselected targets', async (t) => {
  const f = await destinationFixture(t);
  const fs = require('node:fs/promises');
  const first = await f.invoke(
    'journal:save',
    f.windows[0],
    setupInput(),
    chosenDestinations('obsidian'),
  );
  const before = await fs.readFile(first.path);
  await captureReady(f.invoke, f.windows);
  const result = await f.invoke(
    'journal:append',
    f.windows[0],
    setupInput(),
    chosenDestinations('journal'),
  );
  assert.equal(result.localJournal, true);
  assert.ok(result.path.startsWith(f.folders.journal + path.sep));
  assert.deepEqual(await fs.readFile(first.path), before);
  assert.deepEqual(result.sync, []);
  assert.equal(
    (await require('../dist-electron/journal.js').readSetup(result.path)).screenshots.length,
    2,
  );
});

test('private recovery storage rejects symlink redirection without writing to the link target', async (t) => {
  const f = await destinationFixture(t);
  const fs = require('node:fs/promises');
  await fs.symlink(
    f.folders.journal,
    path.join(f.app.getPath(), 'saved-setups'),
    process.platform === 'win32' ? 'junction' : 'dir',
  );
  await assert.rejects(
    f.invoke('journal:save', f.windows[0], setupInput(), chosenDestinations('obsidian')),
    /Could not save/,
  );
  assert.deepEqual(await fs.readdir(f.folders.journal), []);
  assert.equal((await f.invoke('capture:state')).savedPath, null);
});

test('a new local-only save does not retry or cancel older pending deliveries to unchecked targets', async (t) => {
  const f = await destinationFixture(t);
  const fs = require('node:fs/promises');
  await fs.rename(f.folders.obsidian, f.folders.obsidian + '-moved');
  const failed = await f.invoke(
    'journal:save',
    f.windows[0],
    setupInput(),
    chosenDestinations('journal', 'obsidian'),
  );
  assert.equal(failed.sync[0].status, 'failed');
  const local = await f.invoke(
    'journal:save',
    f.windows[0],
    setupInput(),
    chosenDestinations('journal'),
  );
  assert.deepEqual(local.sync, []);
  const older = (await f.invoke('connections:get')).jobs.find(
    (job) => job.id === failed.sync[0].id,
  );
  assert.equal(older.status, 'failed');
  assert.equal(older.source, failed.path);
});

test('private branching keeps the existing Obsidian note identity and can resume the same local note later', async (t) => {
  const f = await destinationFixture(t);
  const fs = require('node:fs/promises');
  const original = await f.invoke(
    'journal:save',
    f.windows[0],
    setupInput(),
    chosenDestinations('journal', 'obsidian'),
  );
  const originalBytes = await fs.readFile(original.path);
  const parent = path.basename(path.dirname(original.path));
  const remote = path.join(f.folders.obsidian, 'TradeFrame', parent, 'setup.md');
  await captureReady(f.invoke, f.windows);
  const privateCopy = await f.invoke(
    'journal:append',
    f.windows[0],
    setupInput(),
    chosenDestinations('obsidian'),
  );
  assert.deepEqual(await fs.readFile(original.path), originalBytes);
  assert.deepEqual(await fs.readdir(path.join(f.folders.obsidian, 'TradeFrame')), [parent]);
  assert.equal(
    (await require('../dist-electron/journal.js').readSetup(remote)).screenshots.length,
    2,
  );
  await captureReady(f.invoke, f.windows);
  const restored = await f.invoke(
    'journal:append',
    f.windows[0],
    setupInput(),
    chosenDestinations('journal', 'obsidian'),
  );
  assert.equal(restored.path, original.path);
  assert.equal(
    (await require('../dist-electron/journal.js').readSetup(remote)).screenshots.length,
    3,
  );
  assert.equal(
    (await require('../dist-electron/journal.js').readSetup(original.path)).screenshots.length,
    3,
  );
  assert.notEqual(privateCopy.path, original.path);
});

test('OneNote-only saving works without any configured local journal or folder prompt', async (t) => {
  const f = await destinationFixture(t, true, false);
  const result = await f.invoke(
    'journal:save',
    f.windows[0],
    setupInput(),
    chosenDestinations('onenote'),
  );
  assert.equal(result.localJournal, false);
  assert.equal(f.dialogs(), 2);
  assert.deepEqual(
    result.sync.map((job) => job.kind),
    ['onenote'],
  );
  assert.equal(result.sync[0].status, 'synced');
  assert.equal((await f.invoke('connections:get')).folders.journal, null);
  assert.equal(f.posts(), 1);
});

const calendarSetupInput = () => ({
  schema: require('../dist-electron/form-schema.js').JOURNAL_SCHEMA,
  values: {
    mode: 'backtest',
    date: '2025-01-07',
    time_ny: '09:34',
    session: 'NY AM',
    symbol: 'TEST',
    direction: 'short',
    model: 'Example',
    d_bias: '',
    result: 'win',
    r: 2,
    note: 'Synthetic',
  },
});

test('promoting a private calendar setup preserves an unrelated same-name local note', async (t) => {
  const f = await destinationFixture(t);
  const fs = require('node:fs/promises');
  const input = calendarSetupInput();
  const existing = await f.invoke(
    'journal:save',
    f.windows[0],
    input,
    chosenDestinations('journal'),
  );
  const originalBytes = await fs.readFile(existing.path);
  await f.invoke('journal:save', f.windows[0], input, chosenDestinations('obsidian'));
  await captureReady(f.invoke, f.windows);
  const promoted = await f.invoke(
    'journal:append',
    f.windows[0],
    input,
    chosenDestinations('journal'),
  );
  assert.notEqual(promoted.path, existing.path);
  assert.match(promoted.path, /\(2\)\.md$/);
  assert.deepEqual(await fs.readFile(existing.path), originalBytes);
  assert.equal(
    (await require('../dist-electron/journal.js').readSetup(promoted.path)).screenshots.length,
    2,
  );
});

test('calendar filing choices and note identity survive deselecting and reselecting the local journal', async (t) => {
  const f = await destinationFixture(t);
  const fs = require('node:fs/promises');
  const rules = await f.invoke('filing:get');
  const rule = { ...rules.journal, root: 'Old', folders: ['date'], name: ['date', 'instrument'] };
  await f.invoke('filing:set', f.windows[0], 'journal', rule);
  const input = calendarSetupInput();
  const original = await f.invoke(
    'journal:save',
    f.windows[0],
    input,
    chosenDestinations('journal', 'obsidian'),
  );
  const originalBytes = await fs.readFile(original.path);
  await f.invoke('filing:set', f.windows[0], 'journal', { ...rule, root: 'New' });
  await captureReady(f.invoke, f.windows);
  await f.invoke('journal:append', f.windows[0], input, chosenDestinations('obsidian'));
  assert.deepEqual(await fs.readFile(original.path), originalBytes);
  await captureReady(f.invoke, f.windows);
  const promoted = await f.invoke(
    'journal:append',
    f.windows[0],
    input,
    chosenDestinations('journal', 'obsidian'),
  );
  assert.equal(promoted.path, original.path);
  assert.equal(
    (await require('../dist-electron/journal.js').readSetup(promoted.path)).screenshots.length,
    3,
  );
  assert.equal(
    await fs.stat(path.join(f.folders.journal, 'New')).then(
      () => true,
      () => false,
    ),
    false,
  );
});

function clipboardFixture(initial = null) {
  let current = initial;
  let reads = 0;
  const clipboard = {
    has: async (type) => {
      assert.equal(type, 'image/png');
      return current !== null;
    },
    read: async () => {
      reads++;
      const bytes = current;
      return [
        {
          types: ['text/html', 'image/png'],
          getType: async (type) => {
            assert.equal(type, 'image/png', 'Never read unrelated clipboard contents');
            return new Blob([bytes]);
          },
        },
      ];
    },
  };
  return {
    clipboard,
    set: (bytes) => {
      current = bytes;
    },
    reads: () => reads,
  };
}

test('Auto imports only new clipboard PNGs while selected, preserves bytes, and never captures or raises windows', async () => {
  const first = syntheticImage(8, 6, () => [20, 40, 60, 255]);
  const second = syntheticImage(8, 6, () => [60, 40, 20, 255]);
  const f = clipboardFixture(first.png);
  let decoded = 0;
  const { invoke, tick, windows, handlers, intervalCount } = await boot(
    async () => assert.fail('Auto must not take a desktop screenshot'),
    undefined,
    true,
    undefined,
    {
      clipboard: f.clipboard,
      nativeImage: {
        ...nativeImage,
        createFromBuffer: (bytes) => {
          decoded++;
          return nativeImage.createFromBuffer(bytes);
        },
      },
    },
  );
  assert.equal(f.reads(), 0);
  assert.equal((await invoke('capture:state')).autoCapture, false);
  await invoke('capture:auto', windows[0], true);
  assert.equal(
    (await invoke('capture:state')).screenshots.length,
    0,
    'Activation ignores the old image',
  );
  await tick();
  assert.equal((await invoke('capture:state')).screenshots.length, 0);
  assert.equal(decoded, 0, 'Do not decode the existing/unchanged PNG every polling interval');
  f.set(second.png);
  await tick();
  await tick();
  let state = await invoke('capture:state');
  assert.equal(state.screenshots.length, 1);
  assert.equal(decoded, 1, 'Decode only a new candidate image');
  assert.equal(state.autoCapture, true);
  assert.equal(state.screenshots[0].timeframe, '');
  assert.equal(
    state.screenshots[0].crop,
    undefined,
    'Exported charts are not automatically cropped',
  );
  assert.equal(windows[0].visible, false, 'Background imports must not steal window focus');
  const response = handlers.get('protocol:tradeframe-image')({
    method: 'GET',
    url: state.screenshots[0].image,
  });
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), second.png);
  f.set(null);
  await tick();
  f.set(second.png);
  await tick();
  assert.equal(
    (await invoke('capture:state')).screenshots.length,
    2,
    'A new copy after clearing is accepted',
  );
  await invoke('capture:auto', windows[0], false);
  const reads = f.reads();
  f.set(first.png);
  await tick();
  assert.equal(f.reads(), reads);
  assert.equal(intervalCount(), 0);
  await assert.rejects(invoke('capture:auto', windows[0], 'true'), /Invalid/);
  await invoke('capture:auto', windows[0], true);
  windows[0].close();
  assert.equal(intervalCount(), 0);
});

test('Auto serializes pending reads and ignores their result after Stop or draft replacement', async () => {
  const png = syntheticImage(5, 5, () => [10, 20, 30, 255]).png;
  const f = clipboardFixture();
  const runtime = { clipboard: f.clipboard };
  const { invoke, tick, windows } = await boot(undefined, undefined, true, undefined, runtime);
  await invoke('capture:auto', windows[0], true);
  let resolve,
    reads = 0;
  f.clipboard.has = async () => true;
  f.clipboard.read = () => {
    reads++;
    return new Promise((r) => {
      resolve = r;
    });
  };
  const pending = tick();
  await new Promise(setImmediate);
  await tick();
  assert.equal(reads, 1);
  await invoke('capture:auto', windows[0], false);
  resolve([{ types: ['image/png'], getType: async () => new Blob([png]) }]);
  await pending;
  assert.equal((await invoke('capture:state')).screenshots.length, 0);
  f.clipboard.has = async () => false;
  await invoke('capture:auto', windows[0], true);
  f.clipboard.has = async () => true;
  const next = tick();
  await new Promise(setImmediate);
  await invoke('journal:new');
  resolve([{ types: ['image/png'], getType: async () => new Blob([png]) }]);
  await next;
  assert.equal((await invoke('capture:state')).autoCapture, false);
  assert.equal((await invoke('capture:state')).screenshots.length, 0);
});

test('Auto stops safely at invalid data, oversized images and twenty screenshots', async () => {
  const f = clipboardFixture();
  const { invoke, tick, windows, intervalCount } = await boot(
    undefined,
    undefined,
    true,
    undefined,
    { clipboard: f.clipboard },
  );
  await invoke('capture:auto', windows[0], true);
  f.set(syntheticImage(4, 4, () => [1, 2, 3, 255]).png);
  await tick();
  f.set(Buffer.from('not a PNG'));
  await tick();
  assert.equal((await invoke('capture:state')).screenshots.length, 1);
  assert.equal((await invoke('capture:state')).autoCapture, false);
  assert.match((await invoke('capture:state')).error, /Auto stopped/);
  f.set(null);
  await invoke('capture:auto', windows[0], true);
  const oversized = Buffer.from(syntheticImage(4, 4, () => [2, 3, 4, 255]).png);
  oversized.writeUInt32BE(100000, 16);
  f.set(oversized);
  await tick();
  assert.equal((await invoke('capture:state')).screenshots.length, 1);
  assert.equal((await invoke('capture:state')).autoCapture, false);
  f.set(null);
  await invoke('capture:auto', windows[0], true);
  for (let i = 0; i < 19; i++) {
    f.set(syntheticImage(4, 4, () => [10 + i, 20, 30, 255]).png);
    await tick();
  }
  assert.equal((await invoke('capture:state')).screenshots.length, 20);
  assert.equal((await invoke('capture:state')).autoCapture, false);
  assert.equal(intervalCount(), 0);
  await assert.rejects(invoke('capture:auto', windows[0], true), /20 screenshots/);
});

test('Edit image crops only the selected draft image, retains metadata and cancellation, and permits twenty-image drafts', async () => {
  const full = syntheticImage(400, 300, (x, y) => [x % 256, y % 256, 20, 255]);
  const { app, invoke, windows, handlers } = await boot(
    async () => [{ ...source('screen:0:0'), thumbnail: full }],
    async () => ({ canceled: false, filePaths: [app.getPath()] }),
  );
  await invoke('capture:open-bar');
  await invoke('capture:screenshot', windows[1], 'chart');
  const original = (await invoke('capture:state')).screenshots[0];
  await invoke('capture:timeframe', windows[0], original.id, '5m');
  await invoke('capture:caption', windows[0], original.id, 'Keep notes 🕯');
  const saved = await invoke('journal:save', windows[0], setupInput());
  const fs = require('node:fs/promises');
  const savedBytes = await fs.readFile(saved.path);
  const savedPng = await fs.readFile(path.join(path.dirname(saved.path), 'chart.png'));
  await assert.rejects(invoke('capture:edit', windows[1], original.id), /Untrusted/);
  await assert.rejects(invoke('capture:edit', windows[0], 'missing'), /Invalid/);
  await invoke('capture:edit', windows[0], original.id);
  await invoke('capture:discard');
  assert.equal((await invoke('capture:state')).screenshots[0].image, original.image);
  await invoke('capture:edit', windows[0], original.id);
  const pending = (await invoke('capture:state')).areaSource;
  await invoke('capture:area', windows[0], pending.image, { x: 15, y: 12, width: 9, height: 6 });
  const state = await invoke('capture:state');
  assert.equal(state.screenshots.length, 1);
  const edited = state.screenshots[0];
  assert.equal(edited.id, original.id);
  assert.equal(edited.timeframe, '5m');
  assert.equal(edited.caption, 'Keep notes 🕯');
  assert.equal(edited.capturedAt, original.capturedAt);
  assert.equal(edited.crop, 'area');
  const response = handlers.get('protocol:tradeframe-image')({ method: 'GET', url: edited.image });
  assert.deepEqual(
    Buffer.from(await response.arrayBuffer()),
    full.crop({ x: 15, y: 12, width: 9, height: 6 }).png,
  );
  assert.deepEqual(await fs.readFile(saved.path), savedBytes);
  assert.deepEqual(await fs.readFile(path.join(path.dirname(saved.path), 'chart.png')), savedPng);
  await assert.rejects(invoke('journal:append', windows[0], setupInput()), /Could not append/);
  const copied = await invoke('journal:save', windows[0], setupInput());
  assert.notEqual(copied.path, saved.path);
  assert.deepEqual(await fs.readFile(saved.path), savedBytes);
  for (let i = 0; i < 19; i++) await invoke('capture:screenshot', windows[1], 'chart');
  assert.equal((await invoke('capture:state')).screenshots.length, 20);
  await invoke('capture:edit', windows[0], original.id);
  await invoke('capture:area', windows[0], (await invoke('capture:state')).areaSource.image, {
    x: 0,
    y: 0,
    width: 2,
    height: 2,
  });
  assert.equal((await invoke('capture:state')).screenshots.length, 20);
});

test('stopping Auto during its initial format query prevents any later clipboard content read', async () => {
  let ready,
    reads = 0;
  const clipboard = {
    has: () =>
      new Promise((resolve) => {
        ready = resolve;
      }),
    read: async () => {
      reads++;
      return [];
    },
  };
  const { invoke, windows, intervalCount } = await boot(undefined, undefined, true, undefined, {
    clipboard,
  });
  const pending = invoke('capture:auto', windows[0], true);
  await new Promise(setImmediate);
  await invoke('capture:auto', windows[0], false);
  ready(true);
  await pending;
  assert.equal(reads, 0, 'Stopped Auto must not read clipboard contents');
  assert.equal(intervalCount(), 0);
  assert.equal((await invoke('capture:state')).autoCapture, false);
});
