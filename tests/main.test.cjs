const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { EventEmitter } = require('node:events');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const vm = require('node:vm');

const source = (id, name = 'Synthetic chart') => ({ id, name,
  thumbnail: { isEmpty: () => false, toDataURL: () => 'data:image/png;base64,synthetic' },
});

async function boot(capture = async () => [source('screen:0:0')]) {
  const app = new EventEmitter();
  app.setName = () => {};
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
    show() { this.visible = true; }
    hide() { this.visible = false; }
    isDestroyed() { return !!this.destroyed; }
    close() { this.destroyed = true; this.emit('closed'); }
  }
  const electron = { app, BrowserWindow,
    desktopCapturer: { getSources: () => capture(windows) },
    ipcMain: { handle: (name, fn) => handlers.set(name, fn) },
    dialog: { showErrorBox: () => assert.fail('Unexpected startup error') },
    Menu: { buildFromTemplate: (template) => template, setApplicationMenu: () => {} },
  };
  const dirname = path.resolve(__dirname, '../dist-electron');
  vm.runInNewContext(readFileSync(path.join(dirname, 'main.js'), 'utf8'), {
    exports: {}, __dirname: dirname, process: { platform: 'linux' },
    setTimeout: (callback) => queueMicrotask(callback),
    require: (name) => name === 'electron' ? electron : require(name),
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
  app.emit('window-all-closed');
  assert.equal(app.quitCalled, true);
});

test('floating controls hide both windows for capture and return a transient preview', async () => {
  const { windows, invoke } = await boot(async (windows) => {
    assert.ok(windows.every((w) => !w.visible), 'TradeFrame is hidden before capture');
    return [source('window:99:1', 'TradeFrame'), source('screen:0:0')];
  });
  await invoke('capture:open-bar');
  const [journal, bar] = windows;
  assert.equal(bar.options.title, 'TradeFrame Capture');
  assert.equal(bar.options.frame, false);
  let titlePreserved = false;
  bar.emit('page-title-updated', { preventDefault: () => { titlePreserved = true; } });
  assert.equal(titlePreserved, true);
  assert.equal(bar.options.webPreferences.sandbox, true);
  assert.equal(bar.visible, true);
  assert.equal(journal.visible, false);
  await invoke('capture:screenshot', bar);
  const state = await invoke('capture:state');
  assert.equal(state.preview.id, 'screen:0:0');
  assert.equal(state.sources.length, 0);
  assert.equal(state.busy, false);
  assert.equal(journal.visible, true);
  await invoke('capture:discard');
  assert.equal((await invoke('capture:state')).preview, null);
  await invoke('capture:open-bar');
  bar.close();
  assert.equal(journal.visible, true);
});

test('empty thumbnails restore the journal with an actionable error', async () => {
  const empty = source('screen:0:0');
  empty.thumbnail.isEmpty = () => true;
  const { windows, invoke } = await boot(async () => [empty]);
  await invoke('capture:open-bar');
  await invoke('capture:screenshot', windows[1]);
  const state = await invoke('capture:state');
  assert.equal(state.preview, null);
  assert.equal(state.sources.length, 0);
  assert.match(state.error, /No screenshot/);
  assert.equal(windows[0].visible, true);
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
  assert.equal((await invoke('capture:state')).preview.id, 'screen:0:0');
  await invoke('capture:open-bar');
  await invoke('capture:screenshot', windows[1]);
  await invoke('capture:choose', windows[0], 'window:42:0');
  assert.equal((await invoke('capture:state')).preview.id, 'window:42:0');
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
  assert.equal(state.preview.id, 'screen:0:0');
  assert.match(state.error, /cancelled or screen access/);
  assert.equal(state.busy, false);
  assert.equal(windows[0].visible, true);
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
  assert.equal((await invoke('capture:state', windows[2])).preview, null);
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
  const received = [];
  const unsubscribe = api.onStateChange((...args) => received.push(args));
  const state = { preview: null };
  ipcRenderer.emit('capture:changed', { sender: 'privileged event' }, state);
  assert.deepEqual(received, [[state]]);
  unsubscribe();
  assert.equal(ipcRenderer.listenerCount('capture:changed'), 0);
});
