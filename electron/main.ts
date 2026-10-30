import { app, BrowserWindow, desktopCapturer, dialog, ipcMain, Menu, safeStorage, shell, protocol } from 'electron';
import type { IpcMainInvokeEvent } from 'electron';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { realpath } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import type { CaptureState, CaptureSource } from './capture-types';
import { MAX_SCREENSHOTS } from './form-schema';
import { validateSetup, writeSetup, readSetup, appendScreenshots, pngBytes } from './journal';
import { SchemaStore } from './schema-store';
import { ConnectionStore, folderKind } from './connections';
import { OneNoteClient } from './onenote';
import type { SaveResult } from './capture-types';

app.setName('TradeFrame');
protocol.registerSchemesAsPrivileged([{ scheme: 'tradeframe-image', privileges: { standard: true, secure: true } }]);
const uiFile = path.join(__dirname, '../dist/index.html');
const preload = path.join(__dirname, 'preload.js');
const icon = path.join(__dirname, '../dist/tradeframe-icon.png');
let journal: BrowserWindow | null = null;
let bar: BrowserWindow | null = null;
let schemas: SchemaStore | null = null;
function schemaStore() {
  if (schemas) return schemas;
  const store = new SchemaStore(path.join(app.getPath('userData'), 'form-schemas.sqlite'));
  try {
    const legacy = path.join(__dirname, '../data/form-schemas.sqlite');
    if (!app.isPackaged && existsSync(legacy)) store.importFrom(legacy);
    return schemas = store;
  } catch (error) { store.close(); throw error; }
}
let connections: ConnectionStore | null = null;
function connectionStore() {
  return connections ??= new ConnectionStore(path.join(app.getPath('userData'), 'connections.json'));
}
let oneNote: OneNoteClient | null = null;
function oneNoteClient() {
  if (oneNote) return oneNote;
  const configuration = path.join(__dirname, 'integrations.json');
  const clientId = process.env.TRADEFRAME_MICROSOFT_CLIENT_ID
    ?? (existsSync(configuration) ? JSON.parse(readFileSync(configuration, 'utf8')).microsoftClientId : '');
  return oneNote = new OneNoteClient(app.getPath('userData'), safeStorage, clientId);
}
const deliverOneNote = (file: string, section: string, id: string) => oneNoteClient().deliver(file, section, id);
let state: CaptureState = { barOpen: false, busy: false, sources: [], screenshots: [], savedPath: null, error: null };
let savedFingerprint = '';
let capturedAt = '';
const images = new Map<string, Buffer>();

function cacheImage(image: string) {
  const bytes = pngBytes(image);
  if ([...images.values()].reduce((sum, item) => sum + item.length, bytes.length) > 256_000_000) throw new Error('Capture images exceed the memory limit');
  const url = `tradeframe-image://capture/${randomUUID()}`;
  images.set(url, bytes);
  return url;
}

function appendScreenshot(source: CaptureSource) {
  if (state.screenshots.length >= MAX_SCREENSHOTS) throw new Error('A setup can contain up to 20 screenshots');
  const bytes = [...state.screenshots, source].reduce((sum, shot) => sum + images.get(shot.image)!.length, 0);
  if (bytes > 128_000_000) throw new Error('Screenshots exceed 128 MB');
  state.screenshots.push({ id: randomUUID(), image: source.image, caption: '', capturedAt });
  state.sources = [];
}

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
  const used = new Set([...state.screenshots, ...state.sources].map((shot) => shot.image));
  for (const url of images.keys()) if (!used.has(url)) images.delete(url);
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
      backgroundColor: '#060606',
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
  if (state.screenshots.length >= MAX_SCREENSHOTS) {
    state.error = 'This setup has 20 screenshots. Remove one before capturing another.';
    publish();
    return;
  }
  const owner = journal;
  capturedAt = new Date().toISOString();
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
      .map((source) => ({ id: source.id, name: source.name, image: cacheImage(source.thumbnail.toDataURL()) }));
    if (state.sources.length === 1) {
      appendScreenshot(state.sources[0]);
    } else if (state.sources.length === 0) {
      state.error = 'No screenshot was captured. Try again and allow screen access when prompted.';
    }
  } catch {
    if (journal !== owner) return;
    state.error = 'Capture was cancelled or screen access was unavailable. You can try again; your screenshots are unchanged.';
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
  ipcMain.handle('journal:new', (event) => {
    assertSender(event, journal);
    if (state.busy) throw new Error('Wait for the current operation to finish');
    state = { ...state, sources: [], screenshots: [], savedPath: null, error: null };
    savedFingerprint = '';
    publish();
  });
  ipcMain.handle('onenote:state', (event) => { assertSender(event, journal); return oneNoteClient().getState(); });
  for (const operation of ['configure', 'connect', 'poll', 'disconnect'] as const) {
    ipcMain.handle(`onenote:${operation}`, async (event, input: unknown) => {
      assertSender(event, journal);
      if (state.busy) {
        if (operation === 'poll') return oneNoteClient().getState();
        throw new Error('Wait for the current operation to finish');
      }
      state.busy = true; publish();
      try {
        if (operation === 'configure') {
          const result = await oneNoteClient().configure(input);
          connectionStore().cancelOneNote();
          return result;
        }
        if (operation === 'connect') return await oneNoteClient().begin();
        if (operation === 'poll') return await oneNoteClient().poll();
        const result = await oneNoteClient().disconnect();
        connectionStore().cancelOneNote();
        return result;
      } finally { state.busy = false; publish(); }
    });
  }
  ipcMain.handle('onenote:browser', async (event) => {
    assertSender(event, journal);
    if (!(await oneNoteClient().getState()).login) throw new Error('Start OneNote sign-in first');
    await shell.openExternal('https://microsoft.com/devicelogin');
  });
  ipcMain.handle('connections:get', (event) => { assertSender(event, journal); return connectionStore().get(); });
  ipcMain.handle('connections:folder', async (event, kind: unknown) => {
    assertSender(event, journal);
    folderKind(kind);
    const owner = journal;
    if (!owner || state.busy) throw new Error('Wait for the current operation to finish');
    state.busy = true; publish();
    try {
      const selection = await dialog.showOpenDialog(owner, {
        title: kind === 'journal' ? 'Choose local journal folder' : `Choose ${kind === 'obsidian' ? 'Obsidian vault' : 'Dropbox folder'}`,
        properties: ['openDirectory', 'createDirectory'],
      });
      if (selection.canceled || !selection.filePaths.length || journal !== owner) return connectionStore().get();
      return connectionStore().setFolder(kind, await realpath(selection.filePaths[0]));
    } finally { if (journal === owner) { state.busy = false; publish(); } }
  });
  ipcMain.handle('connections:disconnect', (event, kind: unknown) => {
    assertSender(event, journal);
    folderKind(kind);
    if (state.busy) throw new Error('Wait for the current operation to finish');
    return connectionStore().setFolder(kind, null);
  });
  ipcMain.handle('connections:retry', async (event) => {
    assertSender(event, journal);
    if (state.busy) throw new Error('Wait for the current operation to finish');
    state.busy = true; publish();
    try { await connectionStore().retry(undefined, deliverOneNote); return connectionStore().get(); }
    finally { state.busy = false; publish(); }
  });
  ipcMain.handle('forms:list', (event) => { assertSender(event, journal); return schemaStore().list(); });
  ipcMain.handle('forms:save', (event, input: unknown) => {
    assertSender(event, journal);
    if (state.busy) throw new Error('Wait for the current operation to finish');
    return schemaStore().save(input);
  });
  ipcMain.handle('journal:open', async (event) => {
    assertSender(event, journal);
    const owner = journal;
    if (!owner || state.busy) throw new Error('Wait for the current operation to finish');
    state.busy = true;
    publish();
    try {
      const selection = await dialog.showOpenDialog(owner, {
        title: 'Open TradeFrame setup', properties: ['openFile'], filters: [{ name: 'Markdown setup', extensions: ['md'] }],
      });
      if (selection.canceled || !selection.filePaths.length || journal !== owner) return null;
      const loaded = await readSetup(selection.filePaths[0]);
      if (journal !== owner) return null;
      schemaStore().remember(loaded.schema);
      const screenshots = loaded.screenshots.map((shot) => ({ ...shot, image: cacheImage(shot.image) }));
      state = { ...state, sources: [], screenshots, savedPath: selection.filePaths[0], error: null };
      savedFingerprint = loaded.fingerprint;
      return { schema: loaded.schema, values: loaded.values };
    } finally {
      if (journal === owner) { state.busy = false; publish(); }
    }
  });
  for (const operation of ['save', 'append'] as const) ipcMain.handle(`journal:${operation}`, async (event, input: unknown): Promise<SaveResult> => {
    assertSender(event, journal);
    const owner = journal;
    if (!owner || state.busy || !state.screenshots.length || state.sources.length) {
      throw new Error('Choose a screenshot before saving');
    }
    const setup = validateSetup(input);
    schemaStore().remember(setup.schema);
    const screenshots = state.screenshots.map((shot) => ({ ...shot, image: `data:image/png;base64,${images.get(shot.image)!.toString('base64')}` }));
    state.busy = true;
    publish();
    try {
      const store = connectionStore();
      let folder = store.get().folders.journal;
      if (operation === 'save' && !folder) {
        const selection = await dialog.showOpenDialog(owner, {
          title: 'Choose journal folder', buttonLabel: 'Save setup here',
          properties: ['openDirectory', 'createDirectory'],
        });
        if (selection.canceled || !selection.filePaths.length || journal !== owner) return { status: 'cancelled' };
        folder = await realpath(selection.filePaths[0]);
        store.setFolder('journal', folder);
      }
      let savedPath: string;
      if (operation === 'append') {
        if (!state.savedPath) throw new Error('Open or save a setup before adding screenshots');
        await appendScreenshots(state.savedPath, savedFingerprint, setup, screenshots);
        savedPath = state.savedPath;
      } else savedPath = await writeSetup(folder!, setup, screenshots);
      state.savedPath = savedPath;
      savedFingerprint = (await readSetup(savedPath)).fingerprint;
      try {
        const oneNoteState = await oneNoteClient().getState();
        const jobs = store.enqueue(savedPath, oneNoteState.connected ? oneNoteState.section : undefined);
        const sync = await store.retry(jobs.map((job) => job.id), deliverOneNote);
        return { status: 'saved', path: savedPath, sync };
      } catch {
        return { status: 'saved', path: savedPath, sync: [], warning: 'Local save succeeded, but sync could not finish. Check Connections before retrying.' };
      }
    } catch (error) {
      if (operation === 'append') throw new Error('Could not append. Keep existing fields and screenshots unchanged, or reopen a file changed elsewhere. The original content and any backup remain in its folder.');
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
    appendScreenshot(source);
    state.error = null;
    publish();
  });
  ipcMain.handle('capture:discard', (event) => {
    assertSender(event, journal);
    if (state.busy) return;
    // Cancelling selection preserves all screenshots already added to the setup.
    state = { ...state, sources: [], error: null };
    publish();
  });
  ipcMain.handle('capture:remove', (event, id: unknown) => {
    assertSender(event, journal);
    if (state.busy || typeof id !== 'string' || !state.screenshots.some((shot) => shot.id === id)) throw new Error('Invalid screenshot');
    state.screenshots = state.screenshots.filter((shot) => shot.id !== id);
    state.error = null;
    publish();
  });
  ipcMain.handle('capture:caption', (event, id: unknown, caption: unknown) => {
    assertSender(event, journal);
    const shot = state.screenshots.find((shot) => shot.id === id);
    if (state.busy || !shot || typeof caption !== 'string' || caption.length > 200 || /[\r\n\0]/.test(caption)) throw new Error('Invalid screenshot caption');
    shot.caption = caption;
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
    show: false, backgroundColor: '#000000',
    webPreferences: { preload, nodeIntegration: false, contextIsolation: true, sandbox: true },
  });
  journal = window;
  protectWindow(window);
  window.webContents.on('will-prevent-unload', (event) => {
    const choice = dialog.showMessageBoxSync(window, {
      type: 'question', buttons: ['Discard draft', 'Keep editing'], defaultId: 1, cancelId: 1,
      title: 'Keep your setup?', message: 'Your current fields and screenshots will be closed.',
      detail: 'Save a copy before closing if you need to keep them. Saved files are unchanged.',
    });
    if (choice === 0) event.preventDefault();
  });
  window.once('ready-to-show', () => window.show());
  window.on('closed', () => {
    journal = null;
    bar?.close();
    state = { barOpen: false, busy: false, sources: [], screenshots: [], savedPath: null, error: null };
    savedFingerprint = '';
    images.clear();
  });
  window.loadFile(uiFile).catch((error: Error) => {
    dialog.showErrorBox('TradeFrame could not start', error.message);
    app.quit();
  });
}

app.whenReady().then(() => {
  protocol.handle('tradeframe-image', (request) => {
    const bytes = request.method === 'GET' ? images.get(request.url) : undefined;
    return bytes ? new Response(new Uint8Array(bytes), { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' } })
      : new Response(null, { status: 404 });
  });
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
app.on('will-quit', () => { schemas?.close(); schemas = null; });
