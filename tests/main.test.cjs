const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { EventEmitter } = require('node:events');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const vm = require('node:vm');
const dataRoots = [];
process.once('exit', () => { for (const root of dataRoots) require('node:fs').rmSync(root, { recursive: true, force: true }); });
const { DEFAULT_SCHEMA } = require('../dist-electron/form-schema.js');
const setupInput = (values = {}) => ({ schema: DEFAULT_SCHEMA, values: {
  mode: 'live', direction: 'long', symbol: 'TEST', model: 'Test', timeframe: '5m', entryTimeNewYork: '', note: '', ...values,
} });

const source = (id, name = 'Synthetic chart') => ({ id, name,
  thumbnail: { isEmpty: () => false, toDataURL: () => 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=' },
});

async function boot(capture = async () => [source('screen:0:0')], selectFolder = async () => ({ canceled: true, filePaths: [] }), primaryInstance = true) {
  const fsSync = require('node:fs');
  const dataRoot = fsSync.mkdtempSync(path.join(require('node:os').tmpdir(), 'tradeframe-main-test-'));
  dataRoots.push(dataRoot);
  const app = new EventEmitter();
  app.getPath = () => dataRoot;
  app.isPackaged = true;
  app.setName = () => {};
  app.requestSingleInstanceLock = () => primaryInstance;
  app.whenReady = () => Promise.resolve();
  app.quit = () => { app.quitCalled = true; };
  const windows = [];
  const handlers = new Map();
  class BrowserWindow extends EventEmitter {
    static getAllWindows() { return windows.filter((w) => !w.destroyed); }
    constructor(options) {
      super();
      this.options = options;
      this.visible = false;
      this.opacity = 1;
      this.ignoreMouseEvents = false;
      this.position = [0, 0];
      this.webContents = new EventEmitter();
      this.webContents.mainFrame = { url: '' };
      this.webContents.setWindowOpenHandler = (handler) => { this.open = handler; };
      this.webContents.send = () => {};
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
    hide() { this.visible = false; }
    focus() { this.focused = true; }
    setOpacity(value) { this.opacity = value; }
    setIgnoreMouseEvents(value) { this.ignoreMouseEvents = value; }
    isDestroyed() { return !!this.destroyed; }
    close() { this.destroyed = true; this.emit('closed'); }
  }
  const electron = { app, BrowserWindow,
    protocol: { registerSchemesAsPrivileged: () => {}, handle: (scheme, handler) => handlers.set(`protocol:${scheme}`, handler) },
    desktopCapturer: { getSources: () => capture(windows) },
    ipcMain: { handle: (name, fn) => handlers.set(name, fn) },
    dialog: { showErrorBox: () => assert.fail('Unexpected startup error'), showOpenDialog: selectFolder, showMessageBoxSync: () => 1 },
    Menu: { buildFromTemplate: (template) => template, setApplicationMenu: () => {} },
  };
  const dirname = path.resolve(__dirname, '../dist-electron');
  vm.runInNewContext(readFileSync(path.join(dirname, 'main.js'), 'utf8'), {
    exports: {}, __dirname: dirname, process: { platform: 'linux', env: {} },
    Buffer, Response, Uint8Array,
    setTimeout: (callback) => queueMicrotask(callback),
    require: (name) => name === 'electron' ? electron : name === './schema-store'
      ? { SchemaStore: class extends require('../dist-electron/schema-store.js').SchemaStore { constructor() { super(':memory:'); } } }
      : require(name.startsWith('./') ? path.join(dirname, name) : name),
  });
  await new Promise(setImmediate);
  const invoke = async (name, window = windows[0], ...args) => handlers.get(name)({
    sender: window.webContents, senderFrame: window.webContents.mainFrame,
  }, ...args);
  return { app, windows, handlers, invoke };
}

test('startup loads only local UI with isolation and blocks navigation/new windows', async () => {
  const { app, windows: [window] } = await boot();
  assert.equal(window.file, path.resolve(__dirname, '../dist/index.html'));
  assert.equal(window.options.icon, path.resolve(__dirname, '../dist/tradeframe-icon.png'));
  assert.equal(window.visible, false);
  window.emit('ready-to-show');
  assert.equal(window.visible, true);
  assert.equal(window.open({ url: 'https://example.com' }).action, 'deny');
  let prevented = false;
  window.webContents.emit('will-navigate', { preventDefault: () => { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(window.options.webPreferences.nodeIntegration, false);
  assert.equal(window.options.webPreferences.contextIsolation, true);
  assert.equal(window.options.webPreferences.sandbox, true);
  assert.equal(window.options.webPreferences.preload, path.resolve(__dirname, '../dist-electron/preload.js'));
  let discarded = false;
  window.webContents.emit('will-prevent-unload', { preventDefault: () => { discarded = true; } });
  assert.equal(discarded, false, 'The draft-close dialog keeps editing by default');
  app.emit('window-all-closed');
  assert.equal(app.quitCalled, true);
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

test('capture keeps the journal visible and preserves the mapped bar position across screenshots', async () => {
  const { windows, invoke, app } = await boot(async (windows) => {
    assert.equal(windows[0].visible, true, 'The journal stays visible during source selection');
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
  bar.emit('page-title-updated', { preventDefault: () => { titlePreserved = true; } });
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
  await invoke('capture:screenshot', windows[1]);
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
  await invoke('capture:screenshot', windows[1]);
  const state = await invoke('capture:state');
  const url = state.screenshots[0].image;
  assert.ok(JSON.stringify(state).length < 1000);
  assert.doesNotMatch(JSON.stringify(state), /data:image/);
  const serve = handlers.get('protocol:tradeframe-image');
  const response = serve({ method: 'GET', url });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Content-Type'), 'image/png');
  assert.deepEqual(Buffer.from(await response.arrayBuffer()).subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  for (const request of [{ method: 'POST', url }, { method: 'GET', url: 'tradeframe-image://capture/../../secrets' }, { method: 'GET', url: `${url}?extra` }]) {
    assert.equal(serve(request).status, 404);
  }
  await invoke('capture:remove', windows[0], state.screenshots[0].id);
  assert.equal(serve({ method: 'GET', url }).status, 404);
});

test('OneNote operations and login browser are unavailable to the capture bar', async () => {
  const { windows, invoke } = await boot();
  await invoke('capture:open-bar');
  for (const operation of ['state', 'connect', 'configure', 'poll', 'disconnect', 'browser']) {
    await assert.rejects(invoke(`onenote:${operation}`, windows[1]), /Untrusted/);
  }
  await assert.rejects(invoke('onenote:browser'), /Start OneNote sign-in/);
});

test('repeated captures append distinct screenshots and validate caption/removal commands', async () => {
  const { windows, invoke } = await boot();
  await invoke('capture:open-bar');
  for (let i = 0; i < 20; i++) await invoke('capture:screenshot', windows[1]);
  const shots = (await invoke('capture:state')).screenshots;
  assert.equal(shots.length, 20);
  assert.equal(new Set(shots.map((shot) => shot.id)).size, 20);
  await invoke('capture:screenshot', windows[1]);
  assert.equal((await invoke('capture:state')).screenshots.length, 20);
  assert.match((await invoke('capture:state')).error, /20 screenshots/);
  await assert.rejects(invoke('capture:caption', windows[1], shots[0].id, 'Wrong window'), /Untrusted/);
  await assert.rejects(invoke('capture:caption', windows[0], shots[0].id, 'x'.repeat(201)), /Invalid/);
  await assert.rejects(invoke('capture:remove', windows[0], 'missing'), /Invalid/);
  await invoke('capture:caption', windows[0], shots[0].id, '5m entry');
  assert.equal((await invoke('capture:state')).screenshots[0].caption, '5m entry');
  await invoke('capture:remove', windows[0], shots[1].id);
  assert.equal((await invoke('capture:state')).screenshots.length, 19);
  await invoke('capture:screenshot', windows[1]);
  assert.equal((await invoke('capture:state')).screenshots.length, 20);
  await assert.rejects(invoke('journal:new', windows[1]), /Untrusted/);
  await invoke('journal:new');
  assert.equal((await invoke('capture:state')).screenshots.length, 0);
});

test('source selection rejects stale ids and cancellation keeps the previous preview', async () => {
  let count = 0;
  const { windows, invoke } = await boot(async () => ++count === 1
    ? [source('screen:0:0')]
    : [source('screen:0:0'), source('window:42:0')]);
  await invoke('capture:open-bar');
  await invoke('capture:screenshot', windows[1]);
  await invoke('capture:open-bar');
  await invoke('capture:screenshot', windows[1]);
  assert.equal((await invoke('capture:state')).sources.length, 2);
  await assert.rejects(invoke('capture:choose', windows[0], 'window:unknown:0'), /no longer available/);
  await assert.rejects(invoke('capture:choose', windows[0], { id: 'screen:0:0' }), /Invalid/);
  await invoke('capture:discard');
  assert.equal((await invoke('capture:state')).screenshots.length, 1);
  await invoke('capture:open-bar');
  await invoke('capture:screenshot', windows[1]);
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
  await invoke('capture:screenshot', windows[1]);
  await invoke('capture:open-bar');
  await invoke('capture:screenshot', windows[1]);
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
  assert.throws(() => state({ sender: journal.webContents, senderFrame: journal.webContents.mainFrame }), /Untrusted/);
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
    return new Promise((done) => { resolve = done; });
  });
  await invoke('capture:open-bar');
  const first = invoke('capture:screenshot', windows[1]);
  await new Promise(setImmediate);
  await invoke('capture:screenshot', windows[1]);
  assert.equal(calls, 1);
  resolve([source('screen:0:0')]);
  await first;
});

test('closing the journal during capture drops the pending image', async () => {
  let resolve;
  const { windows, invoke, app } = await boot(() => new Promise((done) => { resolve = done; }));
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
  ipcRenderer.invoke = (...args) => { calls.push(args); return Promise.resolve(); };
  let api;
  vm.runInNewContext(readFileSync(path.resolve(__dirname, '../dist-electron/preload.js'), 'utf8'), {
    exports: {}, require: () => ({ ipcRenderer, contextBridge: { exposeInMainWorld: (_name, value) => { api = value; } } }),
  });
  api.chooseSource('screen:0:0');
  assert.deepEqual(calls[0], ['capture:choose', 'screen:0:0']);
  assert.equal(api.invoke, undefined);
  api.saveSetup({ symbol: 'Synthetic' });
  assert.deepEqual(calls[1], ['journal:save', { symbol: 'Synthetic' }]);
  api.getSchemas();
  api.saveSchema(DEFAULT_SCHEMA);
  api.openSetup();
  assert.deepEqual(calls.slice(2), [['forms:list'], ['forms:save', DEFAULT_SCHEMA], ['journal:open']]);
  const received = [];
  const unsubscribe = api.onStateChange((...args) => received.push(args));
  const state = { preview: null };
  ipcRenderer.emit('capture:changed', { sender: 'privileged event' }, state);
  assert.deepEqual(received, [[state]]);
  unsubscribe();
  assert.equal(ipcRenderer.listenerCount('capture:changed'), 0);
});

test('saving requires a journal screenshot and cancellation preserves it while blocking parallel capture', async () => {
  let resolve;
  const { windows, invoke } = await boot(undefined, () => new Promise((done) => { resolve = done; }));
  const input = setupInput();
  await assert.rejects(invoke('journal:save', windows[0], input), /Choose a screenshot/);
  await invoke('capture:open-bar');
  await invoke('capture:screenshot', windows[1]);
  await assert.rejects(invoke('journal:save', windows[1], input), /Untrusted/);
  await assert.rejects(invoke('journal:save', windows[0], setupInput({ symbol: '' })), /Symbol/);
  const pending = invoke('journal:save', windows[0], input);
  assert.equal((await invoke('capture:state')).busy, true);
  await assert.rejects(invoke('journal:save', windows[0], input), /Choose a screenshot/);
  await invoke('capture:discard');
  resolve({ canceled: true, filePaths: [] });
  assert.equal((await pending).status, 'cancelled');
  assert.equal((await invoke('capture:state')).screenshots.length, 1);
  assert.equal((await invoke('capture:state')).busy, false);
});

test('save failures preserve the preview and unlock the controls for retry', async () => {
  const { windows, invoke } = await boot(undefined, async () => { throw new Error('Synthetic folder failure'); });
  await invoke('capture:open-bar');
  await invoke('capture:screenshot', windows[1]);
  await assert.rejects(invoke('journal:save', windows[0], setupInput({ mode: 'backtest', direction: 'short' })), /Could not save/);
  assert.equal((await invoke('capture:state')).screenshots.length, 1);
  assert.equal((await invoke('capture:state')).busy, false);
});

test('journal save writes the selected native snapshot to the chosen folder', async (t) => {
  const fs = require('node:fs/promises');
  const root = await fs.mkdtemp(path.join(require('node:os').tmpdir(), 'tradeframe-ipc-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
  const snapshot = source('screen:0:0');
  snapshot.thumbnail.toDataURL = () => image;
  const { windows, invoke } = await boot(async () => [snapshot], async (owner, options) => {
    assert.equal(owner, windows[0]);
    assert.ok(options.properties.includes('openDirectory'));
    return { canceled: false, filePaths: [root] };
  });
  await invoke('capture:open-bar');
  await invoke('capture:screenshot', windows[1]);
  const saved = await invoke('journal:save', windows[0], setupInput({ note: 'Synthetic' }));
  assert.equal(saved.status, 'saved');
  assert.equal(path.dirname(path.dirname(saved.path)), root);
  assert.match(await fs.readFile(saved.path, 'utf8'), /Synthetic/);
  assert.equal((await fs.readFile(path.join(path.dirname(saved.path), 'chart.png'))).toString('base64'), image.split(',')[1]);
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

test('opening a setup restores its schema values and image without modifying the source', async (t) => {
  const fs = require('node:fs/promises');
  const root = await fs.mkdtemp(path.join(require('node:os').tmpdir(), 'tradeframe-open-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
  const file = await require('../dist-electron/journal.js').writeSetup(root, setupInput({ note: 'Restore 🕯' }), [{ id: 'test', image, caption: 'Entry', capturedAt: '2026-10-30T12:00:00.000Z' }]);
  const original = await fs.readFile(file, 'utf8');
  const { windows, invoke, app } = await boot(undefined, async (_, options) => {
    assert.ok(options.properties.includes('openFile'));
    return { canceled: false, filePaths: [file] };
  });
  const opened = await invoke('journal:open');
  assert.equal(opened.values.note, 'Restore 🕯');
  assert.equal(opened.schema.revision, 1);
  assert.match((await invoke('capture:state')).screenshots[0].image, /^tradeframe-image:\/\/capture\//);
  assert.equal((await invoke('capture:state')).busy, false);
  assert.equal(await fs.readFile(file, 'utf8'), original);
  assert.equal((await invoke('forms:list')).length, 1);
  app.emit('will-quit');
});

test('folder connections are journal-only and save sends all screenshots to both targets', async (t) => {
  const fs = require('node:fs/promises');
  const root = await fs.mkdtemp(path.join(require('node:os').tmpdir(), 'tradeframe-destinations-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const folders = ['obsidian', 'dropbox', 'journal'].map((name) => path.join(root, name));
  for (const folder of folders) await fs.mkdir(folder);
  let selections = 0;
  const snapshot = source('screen:0:0');
  snapshot.thumbnail.toDataURL = () => 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
  const { windows, invoke } = await boot(async () => [snapshot], async () => ({ canceled: false, filePaths: [folders[selections++]] }));
  await invoke('capture:open-bar');
  await assert.rejects(invoke('connections:folder', windows[1], 'dropbox'), /Untrusted/);
  await assert.rejects(invoke('connections:folder', windows[0], 'arbitrary'), /Invalid/);
  await invoke('connections:folder', windows[0], 'obsidian');
  await invoke('connections:folder', windows[0], 'dropbox');
  for (let i = 0; i < 2; i++) await invoke('capture:screenshot', windows[1]);
  const saved = await invoke('journal:save', windows[0], setupInput());
  assert.equal(saved.sync.length, 2);
  assert.ok(saved.sync.every((job) => job.status === 'synced'));
  assert.equal((await invoke('connections:get')).folders.journal, folders[2]);
  await invoke('capture:screenshot', windows[1]);
  const appended = await invoke('journal:append', windows[0], setupInput());
  assert.equal(appended.path, saved.path);
  assert.equal((await require('../dist-electron/journal.js').readSetup(saved.path)).screenshots.length, 3);
  assert.ok(appended.sync.every((job) => job.status === 'synced'));
  await invoke('journal:save', windows[0], setupInput());
  assert.equal(selections, 3, 'Saving again uses the remembered journal folder');
  for (const folder of folders.slice(0, 2)) assert.equal((await fs.readdir(path.join(folder, 'TradeFrame'))).length, 2);
});
