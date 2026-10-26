import { app, BrowserWindow, dialog, Menu } from 'electron';
import path from 'node:path';

app.setName('TradeFrame');

function createWindow() {
  const window = new BrowserWindow({
    title: 'TradeFrame',
    width: 1120,
    height: 760,
    minWidth: 640,
    minHeight: 480,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event) => event.preventDefault());
  window.once('ready-to-show', () => window.show());
  window.loadFile(path.join(__dirname, '../dist/index.html')).catch((error: Error) => {
    dialog.showErrorBox('TradeFrame could not start', error.message);
    app.quit();
  });
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    ...(process.platform === 'darwin' ? [{ role: 'appMenu' as const }] : []),
    { role: 'fileMenu' },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' },
  ]));
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
}).catch((error: Error) => {
  dialog.showErrorBox('TradeFrame could not start', error.message);
  app.quit();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
