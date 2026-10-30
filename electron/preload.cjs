const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('polymerDesktop', {
  savePdf: (bytes, name) => ipcRenderer.invoke('save-pdf', bytes, name),
})
