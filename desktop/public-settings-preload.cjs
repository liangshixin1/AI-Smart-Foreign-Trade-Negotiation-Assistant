const {contextBridge, ipcRenderer} = require('electron')
contextBridge.exposeInMainWorld('aiSettings', Object.freeze({
  info: () => ipcRenderer.invoke('public:info'),
  test: value => ipcRenderer.invoke('public:test', value),
  save: value => ipcRenderer.invoke('public:save', value),
  remove: () => ipcRenderer.invoke('public:remove'),
}))
