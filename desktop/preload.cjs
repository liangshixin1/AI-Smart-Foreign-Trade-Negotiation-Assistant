const {contextBridge, ipcRenderer} = require('electron')
contextBridge.exposeInMainWorld('expertDesktop', Object.freeze({
  diagnostics: () => ipcRenderer.invoke('expert:diagnostics'),
}))
