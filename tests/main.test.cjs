const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { EventEmitter } = require('node:events');
const path = require('node:path');
const vm = require('node:vm');

test('startup loads the local UI and blocks navigation away from the app', async () => {
  const app = new EventEmitter();
  app.setName = () => {};
  app.whenReady = () => Promise.resolve();
  let quit = false;
  app.quit = () => { quit = true; };
  const windows = [];
  class BrowserWindow extends EventEmitter {
    static getAllWindows() { return windows; }
    constructor(options) {
      super();
      this.options = options;
      this.webContents = new EventEmitter();
      this.webContents.setWindowOpenHandler = (handler) => { this.open = handler; };
      windows.push(this);
    }
    loadFile(file) { this.file = file; return Promise.resolve(); }
    show() { this.visible = true; }
  }
  const electron = { app, BrowserWindow,
    dialog: { showErrorBox: () => assert.fail('Unexpected startup error') },
    Menu: { buildFromTemplate: (template) => template, setApplicationMenu: () => {} },
  };
  const dirname = path.resolve(__dirname, '../dist-electron');
  vm.runInNewContext(readFileSync(path.join(dirname, 'main.js'), 'utf8'), {
    exports: {}, __dirname: dirname, process: { platform: 'linux' },
    require: (name) => name === 'electron' ? electron : require(name),
  });
  await Promise.resolve();
  const [window] = windows;
  assert.equal(window.file, path.resolve(__dirname, '../dist/index.html'));
  assert.equal(window.visible, undefined);
  window.emit('ready-to-show');
  assert.equal(window.visible, true);
  assert.equal(window.open({ url: 'https://example.com' }).action, 'deny');
  let prevented = false;
  window.webContents.emit('will-navigate', { preventDefault: () => { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(window.options.webPreferences.nodeIntegration, false);
  assert.equal(window.options.webPreferences.contextIsolation, true);
  assert.equal(window.options.webPreferences.sandbox, true);
  app.emit('window-all-closed');
  assert.equal(quit, true);
});
