const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  onState: cb => ipcRenderer.on('state', (e, s) => cb(s)),
  onAskRename: cb => ipcRenderer.on('ask-rename', (e, id) => cb(id)),
  send: (ch, ...args) => ipcRenderer.send(ch, ...args),
});
