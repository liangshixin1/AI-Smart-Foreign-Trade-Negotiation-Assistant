const {contextBridge, ipcRenderer} = require('electron')
contextBridge.exposeInMainWorld('credentialWriter', Object.freeze({
  save: value => ipcRenderer.invoke('expert:credential', value),
}))
