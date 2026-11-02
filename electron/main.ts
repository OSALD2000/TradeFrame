import {
  app,
  BrowserWindow,
  desktopCapturer,
  dialog,
  ipcMain,
  Menu,
  nativeImage,
  safeStorage,
  shell,
  protocol,
  screen,
} from 'electron';
import type { IpcMainInvokeEvent } from 'electron';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { realpath } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import type { CaptureState, CaptureSource, CaptureMode } from './capture-types';
import { findChartBounds, validateCrop } from './chart-crop';
import { MAX_SCREENSHOTS, validTimeframe } from './form-schema';
import { validateSetup, writeSetup, readSetup, appendScreenshots, pngBytes } from './journal';
import { SchemaStore } from './schema-store';
import { ConnectionStore, folderKind } from './connections';
import { FilingStore } from './filing-store';
import { OneNoteClient, OneNoteError } from './onenote';
import type { SaveResult } from './capture-types';

// Chromium does not automatically select a system keyring for Sway.
if (
  process.platform === 'linux' &&
  /(?:^|:)sway(?:$|:)/i.test(process.env.XDG_CURRENT_DESKTOP ?? '') &&
  !app.commandLine.hasSwitch('password-store')
)
  app.commandLine.appendSwitch('password-store', 'gnome-libsecret');

app.setName('TradeFrame');
const primaryInstance = app.requestSingleInstanceLock();
if (!primaryInstance) app.quit();
protocol.registerSchemesAsPrivileged([
  { scheme: 'tradeframe-image', privileges: { standard: true, secure: true } },
]);
const uiFile = path.join(__dirname, '../dist/index.html');
const preload = path.join(__dirname, 'preload.js');
const icon = path.join(__dirname, '../dist/tradeframe-icon.png');
let journal: BrowserWindow | null = null;
let areaFullscreen: boolean | null = null;
let areaFullscreenRestore: boolean | null = null;
let answerUnload: ((confirmed: boolean) => void) | null = null;
let bar: BrowserWindow | null = null;
let schemas: SchemaStore | null = null;
function schemaStore() {
  if (schemas) return schemas;
  const store = new SchemaStore(path.join(app.getPath('userData'), 'form-schemas.sqlite'));
  try {
    const legacy = path.join(__dirname, '../data/form-schemas.sqlite');
    if (!app.isPackaged && existsSync(legacy)) store.importFrom(legacy);
    return (schemas = store);
  } catch (error) {
    store.close();
    throw error;
  }
}
let connections: ConnectionStore | null = null;
function connectionStore() {
  return (connections ??= new ConnectionStore(
    path.join(app.getPath('userData'), 'connections.json'),
  ));
}
let oneNote: OneNoteClient | null = null;
let filing: FilingStore | null = null;
function filingStore() {
  return (filing ??= new FilingStore(path.join(app.getPath('userData'), 'filing-rules.json')));
}
function oneNoteClient() {
  if (oneNote) return oneNote;
  const configuration = path.join(__dirname, 'integrations.json');
  const clientId =
    process.env.TRADEFRAME_MICROSOFT_CLIENT_ID ??
    (existsSync(configuration)
      ? JSON.parse(readFileSync(configuration, 'utf8')).microsoftClientId
      : '');
  return (oneNote = new OneNoteClient(app.getPath('userData'), safeStorage, clientId));
}
const deliverOneNote = (file: string, section: string, id: string, notebookId?: string) =>
  oneNoteClient().deliver(file, section, id, notebookId);
let state: CaptureState = {
  barOpen: false,
  busy: false,
  sources: [],
  areaSource: null,
  screenshots: [],
  savedPath: null,
  requiresTimeframeCopy: false,
  error: null,
};
let savedFingerprint = '';
let capturedAt = '';
let captureMode: CaptureMode = 'chart';
const images = new Map<string, Buffer>();

function cacheImage(image: string) {
  const bytes = pngBytes(image);
  if ([...images.values()].reduce((sum, item) => sum + item.length, bytes.length) > 256_000_000)
    throw new Error('Capture images exceed the memory limit');
  const url = `tradeframe-image://capture/${randomUUID()}`;
  images.set(url, bytes);
  return url;
}

function appendScreenshot(source: CaptureSource) {
  if (state.screenshots.length >= MAX_SCREENSHOTS)
    throw new Error('A setup can contain up to 20 screenshots');
  const bytes = [...state.screenshots, source].reduce(
    (sum, shot) => sum + images.get(shot.image)!.length,
    0,
  );
  if (bytes > 128_000_000) throw new Error('Screenshots exceed 128 MB');
  state.screenshots.push({
    id: randomUUID(),
    image: source.image,
    caption: '',
    timeframe: '',
    capturedAt,
    crop: source.crop,
  });
  state.sources = [];
  state.areaSource = null;
}

function selectSource(source: CaptureSource) {
  if (captureMode === 'area') {
    state.areaSource = source;
    state.sources = [];
  } else appendScreenshot(source);
}

function cropChart(image: string): { image: string; crop: 'chart' | 'full' } {
  try {
    // Re-decode the 1x PNG so bitmap bounds and crop coordinates share one pixel scale.
    const original = nativeImage.createFromDataURL(image);
    const { width, height } = original.getSize(1);
    const rectangle = findChartBounds(original.toBitmap({ scaleFactor: 1 }), width, height);
    if (rectangle) {
      const cropped = original.crop(rectangle);
      const size = cropped.getSize(1);
      if (!cropped.isEmpty() && size.width === rectangle.width && size.height === rectangle.height)
        return { image: cropped.toDataURL({ scaleFactor: 1 }), crop: 'chart' };
    }
  } catch {
    // Detection is optional; failure must not lose the captured image or previous screenshots.
  }
  return { image, crop: 'full' };
}

function protectWindow(window: BrowserWindow) {
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event) => event.preventDefault());
}

function assertSender(event: IpcMainInvokeEvent, expected?: BrowserWindow | null) {
  const known =
    expected === undefined
      ? event.sender === journal?.webContents || event.sender === bar?.webContents
      : !!expected && event.sender === expected.webContents;
  if (
    !known ||
    event.senderFrame !== event.sender.mainFrame ||
    event.senderFrame?.url.split(/[?#]/)[0] !== pathToFileURL(uiFile).href
  ) {
    throw new Error('Untrusted capture request');
  }
}

function publish() {
  if (state.areaSource && journal && areaFullscreen === null) {
    areaFullscreen = journal.isFullScreen();
    areaFullscreenRestore = null;
    journal.setFullScreen(true);
  } else if (!state.areaSource && areaFullscreen !== null) {
    const previous = areaFullscreen;
    areaFullscreen = null;
    areaFullscreenRestore = previous;
    journal?.setFullScreen(previous);
  }
  if (bar && !state.busy) {
    bar.setOpacity(state.areaSource ? 0 : 1);
    bar.setIgnoreMouseEvents(!!state.areaSource);
  }
  const used = new Set(
    [...state.screenshots, ...state.sources, ...(state.areaSource ? [state.areaSource] : [])].map(
      (shot) => shot.image,
    ),
  );
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
      width: 680,
      height: 128,
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

async function takeScreenshot(mode: CaptureMode) {
  if (state.busy) return;
  if (state.sources.length || state.areaSource)
    throw new Error('Finish or cancel the current capture selection first');
  if (state.screenshots.length >= MAX_SCREENSHOTS) {
    state.error = 'This setup has 20 screenshots. Remove one before capturing another.';
    publish();
    return;
  }
  const owner = journal;
  captureMode = mode;
  capturedAt = new Date().toISOString();
  state = { ...state, busy: true, sources: [], error: null };
  publish();
  try {
    owner?.hide();
    // Keep the surface mapped so Wayland preserves its user-chosen position.
    bar?.setIgnoreMouseEvents(true);
    bar?.setOpacity(0);
    // Allow the compositor to make the bar transparent before collecting images.
    await new Promise((resolve) => setTimeout(resolve, 300));
    const displays = screen.getAllDisplays();
    const sources = await desktopCapturer.getSources({
      types: ['screen', 'window'],
      thumbnailSize: {
        width: Math.max(
          1,
          ...displays.map((display) => Math.ceil(display.size.width * display.scaleFactor)),
        ),
        height: Math.max(
          1,
          ...displays.map((display) => Math.ceil(display.size.height * display.scaleFactor)),
        ),
      },
    });
    if (journal !== owner) return;
    state.sources = sources
      .filter((source) => !/^window:.*:1$/.test(source.id) && !source.thumbnail.isEmpty())
      .map((source) => {
        const scaleFactor = Math.max(...source.thumbnail.getScaleFactors());
        const image = source.thumbnail.toDataURL({ scaleFactor });
        const result = mode === 'chart' ? cropChart(image) : { image, crop: undefined };
        return {
          id: source.id,
          name: source.name,
          crop: result.crop,
          image: cacheImage(result.image),
        };
      });
    if (state.sources.length === 1) {
      selectSource(state.sources[0]);
    } else if (state.sources.length === 0) {
      state.error = 'No screenshot was captured. Try again and allow screen access when prompted.';
    }
  } catch {
    if (journal !== owner) return;
    state.error =
      'Capture was cancelled or screen access was unavailable. You can try again; your screenshots are unchanged.';
  } finally {
    if (journal === owner) {
      state.busy = false;
      publish();
      journal?.show();
    }
  }
}

function registerCapture() {
  ipcMain.handle('journal:answer-unload', (event, confirmed: unknown) => {
    assertSender(event, journal);
    if (typeof confirmed !== 'boolean' || !answerUnload)
      throw new Error('Invalid unload confirmation');
    answerUnload(confirmed);
  });
  ipcMain.handle('filing:get', (event) => {
    assertSender(event, journal);
    return filingStore().get();
  });
  ipcMain.handle('filing:set', (event, kind: unknown, rule: unknown) => {
    assertSender(event, journal);
    if (state.busy) throw new Error('Wait for the current operation to finish');
    folderKind(kind);
    return filingStore().set(kind, rule);
  });
  ipcMain.handle('guide:open', async (event, topic: unknown) => {
    assertSender(event, journal);
    const pages = {
      entra: 'https://entra.microsoft.com/',
      notebooks: 'https://onenote.cloud.microsoft/notebooks',
      registration:
        'https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-register-app',
      permissions: 'https://learn.microsoft.com/en-us/graph/permissions-reference#notesreadwrite',
    };
    if (typeof topic !== 'string' || !Object.hasOwn(pages, topic))
      throw new Error('Invalid help page');
    await shell.openExternal(pages[topic as keyof typeof pages]);
  });
  ipcMain.handle('journal:new', (event) => {
    assertSender(event, journal);
    if (state.busy) throw new Error('Wait for the current operation to finish');
    state = {
      ...state,
      sources: [],
      areaSource: null,
      screenshots: [],
      savedPath: null,
      requiresTimeframeCopy: false,
      error: null,
    };
    savedFingerprint = '';
    publish();
  });
  ipcMain.handle('onenote:state', (event) => {
    assertSender(event, journal);
    return oneNoteClient().getState();
  });
  for (const operation of [
    'configure',
    'connect',
    'poll',
    'disconnect',
    'notebooks',
    'notebook',
    'setups',
    'open',
    'send',
  ] as const) {
    ipcMain.handle(`onenote:${operation}`, async (event, input: unknown) => {
      assertSender(event, journal);
      if (state.busy) {
        if (operation === 'poll') return oneNoteClient().getState();
        throw new Error('Wait for the current operation to finish');
      }
      state.busy = true;
      publish();
      try {
        if (operation === 'setups') return await oneNoteClient().listSetups();
        if (operation === 'open') {
          const owner = journal;
          const loaded = await oneNoteClient().openSetup(input);
          if (journal !== owner)
            throw new OneNoteError(
              'OneNote import was canceled because the journal window closed.',
            );
          const setup = validateSetup({ schema: loaded.schema, values: loaded.values });
          const screenshots = loaded.screenshots.map((shot) => ({
            ...shot,
            image: cacheImage(shot.image),
          }));
          schemaStore().remember(setup.schema);
          state = {
            ...state,
            sources: [],
            areaSource: null,
            screenshots,
            savedPath: null,
            requiresTimeframeCopy: screenshots.some((shot) => !shot.timeframe),
            error: null,
          };
          savedFingerprint = '';
          return { ...setup, legacy: loaded.legacy, capture: { ...state, busy: false } };
        }
        if (operation === 'send') {
          if (
            !state.savedPath ||
            (await readSetup(state.savedPath)).fingerprint !== savedFingerprint
          )
            throw new OneNoteError(
              'OneNote needs an unchanged saved setup. Open or save it first.',
            );
          const target = await oneNoteClient().getState();
          if (!target.connected || !target.notebook)
            throw new OneNoteError('OneNote needs a connection and a selected notebook first.');
          const store = connectionStore();
          const jobs = store.enqueue(state.savedPath, target.section, target.notebook.id, false);
          const sync = await store.retry(
            jobs.map((job) => job.id),
            deliverOneNote,
          );
          return { status: 'saved', path: state.savedPath, sync } satisfies SaveResult;
        }
        if (operation === 'configure') {
          const result = await oneNoteClient().configure(input);
          connectionStore().cancelOneNote();
          return result;
        }
        if (operation === 'notebooks') return await oneNoteClient().refreshNotebooks();
        if (operation === 'notebook') {
          const current = await oneNoteClient().getState();
          if (!current.connected || !current.notebooks.some((item) => item.id === input))
            throw new Error('Choose an available notebook after signing in');
          connectionStore().cancelOneNote();
          return await oneNoteClient().selectNotebook(input);
        }
        if (operation === 'connect') {
          connectionStore().cancelOneNote();
          return await oneNoteClient().begin();
        }
        if (operation === 'poll') return await oneNoteClient().poll();
        const result = await oneNoteClient().disconnect();
        connectionStore().cancelOneNote();
        return result;
      } catch (error) {
        if (['open', 'setups', 'send'].includes(operation) && !(error instanceof OneNoteError))
          throw new Error(
            'OneNote could not finish. Check Connections and retry; your current draft is unchanged.',
          );
        throw error;
      } finally {
        state.busy = false;
        publish();
      }
    });
  }
  ipcMain.handle('onenote:browser', async (event) => {
    assertSender(event, journal);
    if (!(await oneNoteClient().getState()).login) throw new Error('Start OneNote sign-in first');
    await shell.openExternal('https://microsoft.com/devicelogin');
  });
  ipcMain.handle('connections:get', (event) => {
    assertSender(event, journal);
    return connectionStore().get();
  });
  ipcMain.handle('connections:folder', async (event, kind: unknown) => {
    assertSender(event, journal);
    folderKind(kind);
    const owner = journal;
    if (!owner || state.busy) throw new Error('Wait for the current operation to finish');
    state.busy = true;
    publish();
    try {
      const selection = await dialog.showOpenDialog(owner, {
        title:
          kind === 'journal'
            ? 'Choose local journal folder'
            : `Choose ${kind === 'obsidian' ? 'Obsidian vault' : 'Dropbox folder'}`,
        properties: ['openDirectory', 'createDirectory'],
      });
      if (selection.canceled || !selection.filePaths.length || journal !== owner)
        return connectionStore().get();
      return connectionStore().setFolder(kind, await realpath(selection.filePaths[0]));
    } finally {
      if (journal === owner) {
        state.busy = false;
        publish();
      }
    }
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
    state.busy = true;
    publish();
    try {
      await connectionStore().retry(undefined, deliverOneNote);
      return connectionStore().get();
    } finally {
      state.busy = false;
      publish();
    }
  });
  ipcMain.handle('forms:list', (event) => {
    assertSender(event, journal);
    return schemaStore().list();
  });
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
        title: 'Open TradeFrame setup',
        properties: ['openFile'],
        filters: [{ name: 'Markdown setup', extensions: ['md'] }],
      });
      if (selection.canceled || !selection.filePaths.length || journal !== owner) return null;
      const loaded = await readSetup(selection.filePaths[0]);
      if (journal !== owner) return null;
      schemaStore().remember(loaded.schema);
      const screenshots = loaded.screenshots.map((shot) => ({
        ...shot,
        image: cacheImage(shot.image),
      }));
      state = {
        ...state,
        sources: [],
        areaSource: null,
        screenshots,
        savedPath: selection.filePaths[0],
        requiresTimeframeCopy: loaded.screenshots.some((shot) => !shot.timeframe),
        error: null,
      };
      savedFingerprint = loaded.fingerprint;
      return { schema: loaded.schema, values: loaded.values, capture: { ...state, busy: false } };
    } finally {
      if (journal === owner) {
        state.busy = false;
        publish();
      }
    }
  });
  for (const operation of ['save', 'append'] as const)
    ipcMain.handle(`journal:${operation}`, async (event, input: unknown): Promise<SaveResult> => {
      assertSender(event, journal);
      const owner = journal;
      if (
        !owner ||
        state.busy ||
        !state.screenshots.length ||
        state.sources.length ||
        state.areaSource
      ) {
        throw new Error('Choose a screenshot before saving');
      }
      if (!state.screenshots.every((shot) => validTimeframe(shot.timeframe)))
        throw new Error('Choose a timeframe for every screenshot before saving');
      const setup = validateSetup(input);
      schemaStore().remember(setup.schema);
      const screenshots = state.screenshots.map((shot) => ({
        ...shot,
        image: `data:image/png;base64,${images.get(shot.image)!.toString('base64')}`,
      }));
      state.busy = true;
      publish();
      try {
        const store = connectionStore();
        let folder = store.get().folders.journal;
        if (operation === 'save' && !folder) {
          const selection = await dialog.showOpenDialog(owner, {
            title: 'Choose journal folder',
            buttonLabel: 'Save setup here',
            properties: ['openDirectory', 'createDirectory'],
          });
          if (selection.canceled || !selection.filePaths.length || journal !== owner)
            return { status: 'cancelled' };
          folder = await realpath(selection.filePaths[0]);
          store.setFolder('journal', folder);
        }
        let savedPath: string;
        if (operation === 'append') {
          if (!state.savedPath) throw new Error('Open or save a setup before adding screenshots');
          await appendScreenshots(state.savedPath, savedFingerprint, setup, screenshots);
          savedPath = state.savedPath;
        } else savedPath = await writeSetup(folder!, setup, screenshots, filingStore().snapshot());
        state.savedPath = savedPath;
        state.requiresTimeframeCopy = false;
        savedFingerprint = (await readSetup(savedPath)).fingerprint;
        try {
          const oneNoteState = await oneNoteClient().getState();
          const jobs = store.enqueue(
            savedPath,
            oneNoteState.connected && oneNoteState.notebook ? oneNoteState.section : undefined,
            oneNoteState.connected ? oneNoteState.notebook?.id : undefined,
          );
          const sync = await store.retry(
            jobs.map((job) => job.id),
            deliverOneNote,
          );
          return {
            status: 'saved',
            path: savedPath,
            sync,
            ...(oneNoteState.connected && !oneNoteState.notebook
              ? {
                  warning:
                    'Local save succeeded. Choose a OneNote notebook in Connections, then use Send saved setup to OneNote.',
                }
              : !oneNoteState.connected && oneNoteState.notebook
                ? {
                    warning:
                      'Local save succeeded. OneNote was not sent: reconnect in Connections, then send the saved setup.',
                  }
                : {}),
          };
        } catch {
          return {
            status: 'saved',
            path: savedPath,
            sync: [],
            warning:
              'Local save succeeded, but sync could not finish. Check Connections before retrying.',
          };
        }
      } catch (error) {
        if (operation === 'append')
          throw new Error(
            'Could not append. Keep existing fields and screenshots unchanged, or reopen a file changed elsewhere. The original content and any backup remain in its folder.',
          );
        throw new Error(
          'Could not save the setup. Check folder access and free space, then retry.',
        );
      } finally {
        if (journal === owner) {
          state.busy = false;
          publish();
        }
      }
    });
  ipcMain.handle('capture:state', (event) => {
    assertSender(event);
    return state;
  });
  ipcMain.handle('capture:open-bar', (event) => {
    assertSender(event, journal);
    return openBar();
  });
  ipcMain.handle('capture:screenshot', (event, mode: unknown = 'chart') => {
    assertSender(event, bar);
    if (event.sender !== bar?.webContents) throw new Error('Open the capture bar first');
    if (mode !== 'chart' && mode !== 'area') throw new Error('Invalid capture mode');
    return takeScreenshot(mode);
  });
  ipcMain.handle('capture:choose', (event, id: unknown) => {
    assertSender(event, journal);
    if (state.busy || typeof id !== 'string') throw new Error('Invalid capture selection');
    const source = state.sources.find((item) => item.id === id);
    if (!source) throw new Error('This capture is no longer available. Take another screenshot.');
    selectSource(source);
    state.error = null;
    publish();
  });
  ipcMain.handle('capture:area', (event, image: unknown, rectangle: unknown) => {
    assertSender(event, journal);
    const source = state.areaSource;
    if (state.busy || !source || image !== source.image)
      throw new Error('This capture is no longer available');
    const original = nativeImage.createFromBuffer(images.get(source.image)!);
    const { width, height } = original.getSize(1);
    const bounds = validateCrop(rectangle, width, height);
    const cropped = original.crop(bounds);
    const size = cropped.getSize(1);
    if (cropped.isEmpty() || size.width !== bounds.width || size.height !== bounds.height)
      throw new Error('The capture area could not be copied. Try again.');
    const url = cacheImage(cropped.toDataURL({ scaleFactor: 1 }));
    try {
      appendScreenshot({ ...source, image: url, crop: 'area' });
    } catch (error) {
      images.delete(url);
      throw error;
    }
    state.error = null;
    publish();
  });
  ipcMain.handle('capture:discard', (event) => {
    assertSender(event, journal);
    if (state.busy) return;
    // Cancelling selection preserves all screenshots already added to the setup.
    state = { ...state, sources: [], areaSource: null, error: null };
    publish();
  });
  ipcMain.handle('capture:remove', (event, id: unknown) => {
    assertSender(event, journal);
    if (state.busy || typeof id !== 'string' || !state.screenshots.some((shot) => shot.id === id))
      throw new Error('Invalid screenshot');
    state.screenshots = state.screenshots.filter((shot) => shot.id !== id);
    state.error = null;
    publish();
  });
  ipcMain.handle('capture:caption', (event, id: unknown, caption: unknown) => {
    assertSender(event, journal);
    const shot = state.screenshots.find((shot) => shot.id === id);
    if (
      state.busy ||
      !shot ||
      typeof caption !== 'string' ||
      caption.length > 20000 ||
      /\0/.test(caption)
    )
      throw new Error('Invalid screenshot caption');
    shot.caption = caption;
    publish();
  });
  ipcMain.handle('capture:timeframe', (event, id: unknown, timeframe: unknown) => {
    assertSender(event, journal);
    const shot = state.screenshots.find((shot) => shot.id === id);
    if (
      state.busy ||
      !shot ||
      typeof timeframe !== 'string' ||
      timeframe.length > 5 ||
      /[\r\n\0]/.test(timeframe)
    )
      throw new Error('Invalid screenshot timeframe');
    shot.timeframe = timeframe;
    publish();
  });
  ipcMain.handle('capture:journal', (event) => {
    assertSender(event);
    if (!state.busy) showJournal();
  });
}

function createWindow() {
  const window = new BrowserWindow({
    title: 'TradeFrame',
    width: 1120,
    height: 760,
    minWidth: 640,
    minHeight: 480,
    autoHideMenuBar: true,
    icon,
    show: false,
    backgroundColor: '#000000',
    webPreferences: { preload, nodeIntegration: false, contextIsolation: true, sandbox: true },
  });
  journal = window;
  // macOS full-screen transitions are asynchronous; cancellation can precede entry.
  window.on('enter-full-screen', () => {
    if (!state.areaSource && areaFullscreenRestore === false) window.setFullScreen(false);
  });
  window.on('leave-full-screen', () => {
    areaFullscreenRestore = null;
  });
  protectWindow(window);
  let requested: 'close' | 'reload' | null = null;
  let closing = false;
  let approved = false;
  let quitting = false;
  const beforeQuit = () => {
    quitting = true;
  };
  app.on('before-quit', beforeQuit);
  window.on('close', () => {
    closing = true;
  });
  answerUnload = (confirmed) => {
    if (!requested) throw new Error('No pending unload confirmation');
    const action = requested;
    requested = null;
    closing = false;
    if (!confirmed) {
      quitting = false;
      return;
    }
    approved = true;
    if (quitting) app.quit();
    else if (action === 'close') window.close();
    else window.webContents.reload();
  };
  window.webContents.on('did-finish-load', () => {
    requested = null;
    approved = false;
    closing = false;
  });
  window.webContents.on('will-prevent-unload', (event) => {
    if (approved) {
      approved = false;
      closing = false;
      event.preventDefault();
      return;
    }
    if (requested) return;
    requested = closing || quitting ? 'close' : 'reload';
    closing = false;
    window.webContents.send('journal:unload-requested', requested);
  });
  window.once('ready-to-show', () => window.show());
  window.on('closed', () => {
    app.removeListener('before-quit', beforeQuit);
    answerUnload = null;
    journal = null;
    areaFullscreen = null;
    areaFullscreenRestore = null;
    bar?.close();
    state = {
      barOpen: false,
      busy: false,
      sources: [],
      areaSource: null,
      screenshots: [],
      savedPath: null,
      requiresTimeframeCopy: false,
      error: null,
    };
    savedFingerprint = '';
    images.clear();
  });
  window.loadFile(uiFile).catch((error: Error) => {
    dialog.showErrorBox('TradeFrame could not start', error.message);
    app.quit();
  });
}

if (primaryInstance)
  app
    .whenReady()
    .then(() => {
      protocol.handle('tradeframe-image', (request) => {
        const bytes = request.method === 'GET' ? images.get(request.url) : undefined;
        return bytes
          ? new Response(new Uint8Array(bytes), {
              headers: { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' },
            })
          : new Response(null, { status: 404 });
      });
      app.dock?.setIcon(icon);
      Menu.setApplicationMenu(
        Menu.buildFromTemplate([
          ...(process.platform === 'darwin' ? [{ role: 'appMenu' as const }] : []),
          { role: 'fileMenu' },
          { role: 'editMenu' },
          { role: 'viewMenu' },
          { role: 'windowMenu' },
        ]),
      );
      registerCapture();
      createWindow();
      app.on('second-instance', () => {
        if (!journal) createWindow();
        else {
          journal.show();
          journal.focus();
        }
      });
      app.on('activate', () => {
        if (!journal) createWindow();
        else if (!state.busy) journal.show();
      });
    })
    .catch((error: Error) => {
      dialog.showErrorBox('TradeFrame could not start', error.message);
      app.quit();
    });

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
app.on('will-quit', () => {
  schemas?.close();
  schemas = null;
});
