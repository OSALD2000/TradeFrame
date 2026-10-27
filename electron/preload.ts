import { contextBridge, ipcRenderer } from 'electron';
import type { CaptureAPI, CaptureState } from './capture-types';

const capture: CaptureAPI = {
  getState: () => ipcRenderer.invoke('capture:state'),
  openBar: () => ipcRenderer.invoke('capture:open-bar'),
  takeScreenshot: () => ipcRenderer.invoke('capture:screenshot'),
  chooseSource: (id) => ipcRenderer.invoke('capture:choose', id),
  discard: () => ipcRenderer.invoke('capture:discard'),
  showJournal: () => ipcRenderer.invoke('capture:journal'),
  saveSetup: (input) => ipcRenderer.invoke('journal:save', input),
  onStateChange: (listener) => {
    const handler = (_event: Electron.IpcRendererEvent, state: CaptureState) => listener(state);
    ipcRenderer.on('capture:changed', handler);
    return () => ipcRenderer.removeListener('capture:changed', handler);
  },
};

contextBridge.exposeInMainWorld('capture', capture);
