import { contextBridge, ipcRenderer } from 'electron';
import type { CaptureAPI, CaptureState } from './capture-types';

const capture: CaptureAPI = {
  getState: () => ipcRenderer.invoke('capture:state'),
  openBar: () => ipcRenderer.invoke('capture:open-bar'),
  takeScreenshot: () => ipcRenderer.invoke('capture:screenshot'),
  chooseSource: (id) => ipcRenderer.invoke('capture:choose', id),
  discard: () => ipcRenderer.invoke('capture:discard'),
  removeScreenshot: (id) => ipcRenderer.invoke('capture:remove', id),
  captionScreenshot: (id, caption) => ipcRenderer.invoke('capture:caption', id, caption),
  newSetup: () => ipcRenderer.invoke('journal:new'),
  showJournal: () => ipcRenderer.invoke('capture:journal'),
  saveSetup: (input) => ipcRenderer.invoke('journal:save', input),
  appendScreenshots: (input) => ipcRenderer.invoke('journal:append', input),
  getSchemas: () => ipcRenderer.invoke('forms:list'),
  saveSchema: (schema) => ipcRenderer.invoke('forms:save', schema),
  openSetup: () => ipcRenderer.invoke('journal:open'),
  getConnections: () => ipcRenderer.invoke('connections:get'),
  connectFolder: (kind) => ipcRenderer.invoke('connections:folder', kind),
  disconnectFolder: (kind) => ipcRenderer.invoke('connections:disconnect', kind),
  retrySync: () => ipcRenderer.invoke('connections:retry'),
  getOneNote: () => ipcRenderer.invoke('onenote:state'),
  configureOneNote: (clientId) => ipcRenderer.invoke('onenote:configure', clientId),
  connectOneNote: () => ipcRenderer.invoke('onenote:connect'),
  pollOneNote: () => ipcRenderer.invoke('onenote:poll'),
  disconnectOneNote: () => ipcRenderer.invoke('onenote:disconnect'),
  openMicrosoftLogin: () => ipcRenderer.invoke('onenote:browser'),
  onStateChange: (listener) => {
    const handler = (_event: Electron.IpcRendererEvent, state: CaptureState) => listener(state);
    ipcRenderer.on('capture:changed', handler);
    return () => ipcRenderer.removeListener('capture:changed', handler);
  },
};

contextBridge.exposeInMainWorld('capture', capture);
