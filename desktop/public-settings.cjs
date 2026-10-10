const {BrowserWindow, ipcMain, safeStorage} = require('electron')
const {pathToFileURL} = require('node:url')
const path = require('node:path')
const fs = require('node:fs')
const {validatePublicConfig, storeConfig, loadConfig} = require('./public-config.cjs')
let settingsWindow
function setupPublicSettings(app, file, restart) {
  const url = pathToFileURL(path.join(__dirname, 'public-settings.html')).href
  function protect(event) {
    if (!settingsWindow || event.sender !== settingsWindow.webContents ||
        event.senderFrame !== settingsWindow.webContents.mainFrame || event.senderFrame.url !== url) {
      throw new Error('Invalid settings sender')
    }
  }
  ipcMain.handle('public:info', event => {
    protect(event)
    try { const c = loadConfig(file, safeStorage); return {configured:!!c, model:c?.model} }
    catch { return {configured:fs.existsSync(file)} }
  })
  ipcMain.handle('public:test', async (event, input) => {
    protect(event)
    let value
    try { value = validatePublicConfig(input) } catch (e) { return {message:e.message} }
    try {
      const response = await fetch('https://api.deepseek.com/chat/completions', {
        method:'POST', redirect:'error', signal:AbortSignal.timeout(30000),
        headers:{'Content-Type':'application/json', Authorization:'Bearer '+value.key},
        body:JSON.stringify({model:value.model, messages:[{role:'user',content:'Reply only OK.'}], max_tokens:64}),
      })
      const messages = {401:'Key 无效或已撤销。',402:'账户余额不足。',429:'请求过多，请稍后重试。',400:'模型名称或请求不被支持。',404:'模型或接口不可用。'}
      if (!response.ok) return {message:messages[response.status] || '服务暂不可用，请稍后重试。'}
      const data = await response.json()
      return {message:Array.isArray(data.choices) && data.choices.length ? '连接成功。点击“保存并重启应用”后生效。' : '服务响应格式异常，尚不能确认可用。'}
    } catch { return {message:'连接失败或超时，请检查网络后重试。'} }
  })
  ipcMain.handle('public:save', (event, input) => {
    protect(event)
    try { storeConfig(file, input, safeStorage) }
    catch { return {message:'未保存。请核对 Key、模型名称和系统加密存储是否可用。'} }
    setTimeout(restart, 250)
    return {message:'已加密保存，正在重启。'}
  })
  ipcMain.handle('public:remove', event => {
    protect(event)
    try { fs.rmSync(file, {force:true}) } catch { return {message:'删除失败，请检查文件权限。'} }
    setTimeout(restart, 250)
    return {message:'已删除，正在重启至样例模式。'}
  })
  return async function openSettings() {
    if (settingsWindow && !settingsWindow.isDestroyed()) { settingsWindow.show(); settingsWindow.focus(); return settingsWindow }
    settingsWindow = new BrowserWindow({width:760,height:750, autoHideMenuBar:true,
      webPreferences:{preload:path.join(__dirname,'public-settings-preload.cjs'),partition:'public-settings',
        sandbox:true,contextIsolation:true,nodeIntegration:false,webSecurity:true}})
    settingsWindow.webContents.setWindowOpenHandler(() => ({action:'deny'}))
    settingsWindow.webContents.on('will-navigate', e => e.preventDefault())
    settingsWindow.webContents.on('will-attach-webview', e => e.preventDefault())
    settingsWindow.webContents.session.setPermissionRequestHandler((_w,_p,cb) => cb(false))
    settingsWindow.webContents.session.webRequest.onBeforeRequest((details,cb) => cb({cancel:!details.url.startsWith('file:')}))
    await settingsWindow.loadURL(url)
    return settingsWindow
  }
}
module.exports = {setupPublicSettings}
