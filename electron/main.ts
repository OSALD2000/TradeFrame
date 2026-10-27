import { app, BrowserWindow, desktopCapturer, dialog, ipcMain, Menu } from 'electron';
import type { IpcMainInvokeEvent } from 'electron';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { CaptureState } from './capture-types';
import { validateSetup, writeSetup } from './journal';
import type { SaveResult } from './capture-types';

app.setName('TradeFrame');
const uiFile = path.join(__dirname, '../dist/index.html');
const preload = path.join(__dirname, 'preload.js');
const icon = path.join(__dirname, '../dist/tradeframe-icon.png');
let journal: BrowserWindow | null = null;
let bar: BrowserWindow | null = null;
let state: CaptureState = { barOpen: false, busy: false, sources: [], preview: null, error: null };

function protectWindow(window: BrowserWindow) {
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event) => event.preventDefault());
}

function assertSender(event: IpcMainInvokeEvent, expected?: BrowserWindow | null) {
  const known = expected === undefined
    ? event.sender === journal?.webContents || event.sender === bar?.webContents
    : !!expected && event.sender === expected.webContents;
  if (!known || event.senderFrame !== event.sender.mainFrame
    || event.senderFrame?.url.split(/[?#]/)[0] !== pathToFileURL(uiFile).href) {
    throw new Error('Untrusted capture request');
  }
}

function publish() {
  for (const window of [journal, bar]) {
    if (window && !window.isDestroyed()) window.webContents.send('capture:changed', state);
  }
}

function showJournal() {
  state.barOpen = false;
  bar?.hide();
  journal?.show();
  publish();
}

async function openBar() {
  if (state.busy) return;
  if (!bar) {
    const window = new BrowserWindow({
      title: 'TradeFrame Capture',
      icon,
      width: 440,
      height: 104,
      resizable: false,
      maximizable: false,
      fullscreenable: false,
      frame: false,
      alwaysOnTop: true,
      show: false,
      backgroundColor: '#0f1011',
      webPreferences: { preload, nodeIntegration: false, contextIsolation: true, sandbox: true },
    });
    bar = window;
    window.on('page-title-updated', (event) => event.preventDefault());
    protectWindow(window);
    window.on('closed', () => {
      bar = null;
      state.barOpen = false;
      publish();
      journal?.show();
    });
    try {
      await window.loadFile(uiFile, { query: { view: 'capture' } });
    } catch {
      window.close();
      throw new Error('The capture bar could not open. Restart TradeFrame and try again.');
    }
  }
  bar?.show();
  state.barOpen = true;
  publish();
}

async function takeScreenshot() {
  if (state.busy) return;
  const owner = journal;
  state = { ...state, busy: true, sources: [], error: null };
  publish();
  try {
    // Keep the surface mapped so Wayland preserves its user-chosen position.
    bar?.setIgnoreMouseEvents(true);
    bar?.setOpacity(0);
    // Allow the compositor to make the bar transparent before collecting images.
    await new Promise((resolve) => setTimeout(resolve, 300));
    // shortcut: cap snapshots at 2560x1440; revisit native-resolution capture before release.
    const sources = await desktopCapturer.getSources({
      types: ['screen', 'window'],
      thumbnailSize: { width: 2560, height: 1440 },
    });
    if (journal !== owner) return;
    state.sources = sources
      .filter((source) => !/^window:.*:1$/.test(source.id) && !source.thumbnail.isEmpty())
      .map((source) => ({ id: source.id, name: source.name, image: source.thumbnail.toDataURL() }));
    if (state.sources.length === 1) {
      state.preview = state.sources[0];
      state.sources = [];
    } else if (state.sources.length === 0) {
      state.error = 'No screenshot was captured. Try again and allow screen access when prompted.';
    }
  } catch {
    if (journal !== owner) return;
    state.error = 'Capture was cancelled or screen access was unavailable. You can try again; your previous preview is unchanged.';
  } finally {
    if (journal === owner) {
      state.busy = false;
      publish();
      journal?.show();
      bar?.setOpacity(1);
      bar?.setIgnoreMouseEvents(false);
    }
  }
}

function registerCapture() {
  ipcMain.handle('journal:save', async (event, input: unknown): Promise<SaveResult> => {
    assertSender(event, journal);
    const owner = journal;
    if (!owner || state.busy || !state.preview || state.sources.length) {
      throw new Error('Choose a screenshot before saving');
    }
    const setup = validateSetup(input);
    const image = state.preview.image;
    state.busy = true;
    publish();
    try {
      const selection = await dialog.showOpenDialog(owner, {
        title: 'Choose journal folder', buttonLabel: 'Save setup here',
        properties: ['openDirectory', 'createDirectory'],
      });
      if (selection.canceled || !selection.filePaths.length || journal !== owner) return { status: 'cancelled' };
      const savedPath = await writeSetup(selection.filePaths[0], setup, image);
      return { status: 'saved', path: savedPath };
    } catch {
      throw new Error('Could not save the setup. Check folder access and free space, then retry.');
    } finally {
      if (journal === owner) {
        state.busy = false;
        publish();
      }
    }
  });
  ipcMain.handle('capture:state', (event) => { assertSender(event); return state; });
  ipcMain.handle('capture:open-bar', (event) => { assertSender(event, journal); return openBar(); });
  ipcMain.handle('capture:screenshot', (event) => {
    assertSender(event, bar);
    if (event.sender !== bar?.webContents) throw new Error('Open the capture bar first');
    return takeScreenshot();
  });
  ipcMain.handle('capture:choose', (event, id: unknown) => {
    assertSender(event, journal);
    if (state.busy || typeof id !== 'string') throw new Error('Invalid capture selection');
    const source = state.sources.find((item) => item.id === id);
    if (!source) throw new Error('This capture is no longer available. Take another screenshot.');
    state = { ...state, sources: [], preview: source, error: null };
    publish();
  });
  ipcMain.handle('capture:discard', (event) => {
    assertSender(event, journal);
    if (state.busy) return;
    // Cancelling source selection preserves an earlier preview; discarding it clears the image.
    state = { ...state, sources: [], error: null, preview: state.sources.length ? state.preview : null };
    publish();
  });
  ipcMain.handle('capture:journal', (event) => {
    assertSender(event);
    if (!state.busy) showJournal();
  });
}

function createWindow() {
  const window = new BrowserWindow({
    title: 'TradeFrame', width: 1120, height: 760, minWidth: 640, minHeight: 480,
    icon,
    show: false, backgroundColor: '#08090a',
    webPreferences: { preload, nodeIntegration: false, contextIsolation: true, sandbox: true },
  });
  journal = window;
  protectWindow(window);
  window.once('ready-to-show', () => window.show());
  window.on('closed', () => {
    journal = null;
    bar?.close();
    state = { barOpen: false, busy: false, sources: [], preview: null, error: null };
  });
  window.loadFile(uiFile).catch((error: Error) => {
    dialog.showErrorBox('TradeFrame could not start', error.message);
    app.quit();
  });
}

app.whenReady().then(() => {
  app.dock?.setIcon(icon);
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    ...(process.platform === 'darwin' ? [{ role: 'appMenu' as const }] : []),
    { role: 'fileMenu' }, { role: 'editMenu' }, { role: 'viewMenu' }, { role: 'windowMenu' },
  ]));
  registerCapture();
  createWindow();
  app.on('activate', () => {
    if (!journal) createWindow();
    else if (!state.busy) journal.show();
  });
}).catch((error: Error) => {
  dialog.showErrorBox('TradeFrame could not start', error.message);
  app.quit();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
