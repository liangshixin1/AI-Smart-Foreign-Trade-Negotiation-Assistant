const {app, BrowserWindow, dialog, ipcMain, Menu, session, safeStorage} = require('electron')
const {deadline} = require('./deadline.cjs')
const {spawn} = require('node:child_process')
const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')
const readline = require('node:readline')
const {allowedLocalUrl, validateCredential} = require('./security.cjs')

const publicEdition = require('./package.json').publicEdition === true || (!app.isPackaged && process.argv.includes('--public-edition'))
const appName = publicEdition ? 'ForeignTradePublic' : 'ForeignTradeExpert'
app.setName(appName)
if (publicEdition) app.setPath('userData', path.join(app.getPath('appData'), appName))
let openSettings
const configFile = () => path.join(app.getPath('userData'), 'ai-settings.enc')
let child, window, origin, quitting = false, stage = 'starting'
const injectMode = !publicEdition && process.argv.includes('--inject-credentials')
const smokeMode = process.argv.includes('--desktop-smoke')
const smokeFileArg = process.argv.find(arg => arg.startsWith('--smoke-output='))
// Automated tests have their own synthetic data, never the reviewer's history.
if (smokeMode) app.setPath('userData', path.join(app.getPath('temp'), appName + '-Smoke'))
if (!app.requestSingleInstanceLock()) app.quit()
else {
  app.on('second-instance', () => { if (window) { window.restore(); window.focus() } })
  app.whenReady().then(injectMode ? inject : start).catch(fail)
}
app.on('window-all-closed', () => app.quit())
app.on('before-quit', () => {
  quitting = true
  if (child) {
    child.stdin.end()
    setTimeout(() => { if (child && child.exitCode === null) child.kill() }, 2500).unref()
  }
})

function options(preload) {
  return {width: 1280, height: 860, minWidth: 850, minHeight: 640,
    backgroundColor: '#f6faf8', webPreferences: {
      preload: path.join(__dirname, preload), nodeIntegration: false,
      contextIsolation: true, sandbox: true, webSecurity: true,
      // Only the automated test needs consistent rendering while another window is active.
      ...(smokeMode ? {backgroundThrottling:false} : {}),
    }}
}

function restrict(win, accepts) {
  win.webContents.setWindowOpenHandler(() => ({action: 'deny'}))
  win.webContents.on('will-navigate', (event, url) => { if (!accepts(url)) event.preventDefault() })
  win.webContents.on('will-attach-webview', event => event.preventDefault())
}

function verifiedSender(event) {
  return window && event.sender === window.webContents &&
    event.senderFrame === window.webContents.mainFrame &&
    allowedLocalUrl(event.senderFrame.url, origin)
}

function statusFile(data) {
  const file = path.join(app.getPath('userData'), 'desktop-status.json')
  fs.mkdirSync(path.dirname(file), {recursive: true})
  fs.writeFileSync(file, JSON.stringify({version: app.getVersion(), arch: process.arch,
    platform: process.platform, time: new Date().toISOString(), ...data}, null, 2))
}

function smokeRecord(data) {
  if (!smokeMode || !smokeFileArg) return
  const output = smokeFileArg.slice(15)
  fs.mkdirSync(path.dirname(output), {recursive:true})
  fs.writeFileSync(output, JSON.stringify({arch:process.arch, platform:process.platform,
    time:new Date().toISOString(), ...data}, null, 2))
}

function progress(value) {
  stage = value
  if (smokeMode) {
    statusFile({status:'RUNNING', stage})
    smokeRecord({status:'RUNNING', stage})
  }
}

function fail(error) {
  if (quitting) return
  // Persist failure before touching an unresponsive renderer. No page text or keys.
  statusFile({status:'FAIL', stage, category:error?.name || 'StartupError'})
  smokeRecord({status:'FAIL', stage, category:error?.name || 'StartupError'})
  if (!smokeMode) dialog.showErrorBox('体验版启动未完成',
    '请重试启动。若仍失败，请使用“Windows_04_收集诊断”入口。数据库和历史记录已保留。')
  app.quit()
}

function evaluate(expression) {
  return deadline(() => window.webContents.executeJavaScript(expression), 10000, stage)
}

async function rendererReady(expression) {
  for (let i = 0; i < 100; i++) {
    if (await evaluate(expression)) return
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  throw new Error('Renderer smoke check timed out')
}

async function start() {
  progress('credential-validation')
  const token = crypto.randomBytes(32).toString('hex')
  const root = path.resolve(__dirname, '..')
  const credentialFile = app.isPackaged
    ? path.join(process.resourcesPath, 'credential', 'demo-credential.json')
    : path.join(root, 'build', 'desktop-credential', 'demo-credential.json')
  let credential = null
  if (publicEdition) {
    const {loadConfig} = require('./public-config.cjs')
    try { credential = smokeMode ? null : loadConfig(configFile(), safeStorage) }
    catch { dialog.showErrorBox('Key 读取失败', '系统无法解密已保存的 Key。本次以样例模式打开，请在配置 AI 中重新保存或删除 Key。') }
    openSettings = require('./public-settings.cjs').setupPublicSettings(app, configFile(), () => {
      app.relaunch(); app.quit()
    })
  } else if (fs.existsSync(credentialFile)) {
    credential = validateCredential(JSON.parse(fs.readFileSync(credentialFile, 'utf8')), {allowExpired:true})
  }
  const command = app.isPackaged
    ? path.join(process.resourcesPath, 'backend', 'negotiation-backend.exe')
    : process.env.EXPERT_PYTHON || path.join(root, '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python')
  const args = app.isPackaged ? [] : [path.join(root, 'scripts/desktop/backend_entry.py')]
  const env = {...process.env, PYTHONPATH: path.join(root, 'apps/api'), PYTHONUTF8: '1'}
  // Backend also ignores environment settings. Never forward private keys via argv.
  for (const key of Object.keys(env)) if (/DEEPSEEK|API_KEY|DATABASE_URL/i.test(key)) delete env[key]
  fs.mkdirSync(app.getPath('userData'), {recursive:true})
  progress('backend-initialization')
  child = spawn(command, args, {cwd: app.getPath('userData'), env, windowsHide: true,
    stdio: ['pipe', 'pipe', 'pipe']})
  const ready = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Backend readiness timeout')), 120000)
    child.once('error', reject)
    child.stdin.on('error', reject)
    child.once('exit', () => { clearTimeout(timer); if (!origin) reject(new Error('Backend exited')) })
    const lines = readline.createInterface({input: child.stdout})
    lines.on('line', line => {
      try {
        const message = JSON.parse(line)
        if (message.event === 'ready') { clearTimeout(timer); resolve(message) }
        if (message.event === 'failed') { clearTimeout(timer); reject(new Error('Backend initialization failed')) }
      } catch { /* Do not store arbitrary output: it may contain private data. */ }
    })
    // Consume stderr to avoid pipe backpressure, retain no credential-bearing traceback.
    child.stderr.on('data', () => {})
    fs.mkdirSync(app.getPath('userData'), {recursive:true})
    child.stdin.write(JSON.stringify({data_dir: app.getPath('userData'), token, credential, public_edition:publicEdition}) + '\n')
  })
  origin = ready.origin
  progress('backend-readiness')
  if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(origin)) throw new Error('Unexpected backend origin')
  let state
  for (let i = 0; i < 40; i++) {
    try {
      const response = await fetch(origin + '/desktop/status', {headers:{'X-Desktop-Token':token},
        signal:AbortSignal.timeout(2000)})
      if (response.ok) { state = await response.json(); break }
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 150))
  }
  if (!state?.ready) throw new Error('Backend readiness failed')
  const ses = session.defaultSession
  ses.setPermissionRequestHandler((_web, _permission, callback) => callback(false))
  ses.setPermissionCheckHandler(() => false)
  ses.webRequest.onBeforeRequest((details, callback) => callback({
    cancel: !allowedLocalUrl(details.url, origin) && !/^(blob:|data:)/.test(details.url),
  }))
  ses.webRequest.onBeforeSendHeaders((details, callback) => {
    const headers = {...details.requestHeaders}
    if (allowedLocalUrl(details.url, origin)) headers['X-Desktop-Token'] = token
    callback({requestHeaders:headers})
  })
  window = new BrowserWindow(options('preload.cjs'))
  restrict(window, url => allowedLocalUrl(url, origin))
  ipcMain.handle('expert:diagnostics', async event => {
    if (!verifiedSender(event)) throw new Error('Invalid sender')
    return exportDiagnostics()
  })
  Menu.setApplicationMenu(Menu.buildFromTemplate([{label:'体验版', submenu:[
    ...(publicEdition ? [{label:'配置 AI / 更换 Key', click:() => openSettings()}] : []),
    {label:'返回登录 / 切换角色', click: () => window.loadURL(origin + '/login')},
    {label:'导出诊断', click:exportDiagnostics}, {role:'reload'}, {role:'quit'},
  ]}]))
  child.on('exit', () => { if (!quitting) fail(new Error('Backend stopped')) })
  progress('frontend-load')
  await deadline(() => window.loadURL(origin + '/login'), 30000, stage)
  progress('frontend')
  statusFile({status:'READY', mode:state.mode, graph_backend:state.graph_backend,
    graph_version:state.graph_version})
  if (publicEdition && !smokeMode && !credential) openSettings()
  if (smokeMode) {
    await rendererReady("document.body.innerText.includes('体验版')")
    const isolated = await evaluate(
      "typeof require === 'undefined' && typeof process === 'undefined'")
    if (!isolated) throw new Error('Renderer isolation failed')
    await evaluate(
      "Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === '学生体验').click()")
    progress('student-navigation')
    await rendererReady("location.pathname.startsWith('/student') && document.querySelector('#workspace-content') && document.body.innerText.includes('开启你的外贸谈判之旅')")
    progress('student-render')
    // DOM readiness was checked above. A background/occluded window may never
    // deliver animation frames, so use a main-process delay before capture instead.
    await new Promise(resolve => setTimeout(resolve, 500))
    progress('student-api-login')
    const response = await fetch(origin + '/desktop/login/student', {
      method:'POST', headers:{'X-Desktop-Token':token}, signal:AbortSignal.timeout(10000),
    })
    const result = {status:response.ok ? 'PASS' : 'FAIL', arch:process.arch,
      platform:process.platform, mode:state.mode, edition:state.edition, stages:state.stages,
      checks:['backend-ready','frontend-loaded','renderer-isolated','student-button-navigation',
        'synthetic-student-login']}
    if (publicEdition) {
      progress('public-settings')
      const settings = await deadline(() => openSettings(), 10000, stage)
      const isolatedSettings = await deadline(() => settings.webContents.executeJavaScript(
        "typeof require === 'undefined' && typeof process === 'undefined' && !!document.querySelector('#key')"), 10000, stage)
      if (!isolatedSettings) throw new Error('Settings isolation failed')
      const rejected = await deadline(() => settings.webContents.executeJavaScript(
        "window.aiSettings.test({key:'',model:''})"), 10000, stage)
      if (!rejected.message.includes('Key')) throw new Error('Settings validation failed')
      if (smokeFileArg) fs.writeFileSync(smokeFileArg.slice(15) + '.settings.png',
        (await deadline(() => settings.webContents.capturePage(), 10000, stage)).toPNG())
      settings.close()
      result.checks.push('public-settings-isolated', 'invalid-key-rejected')
    }
    if (smokeFileArg) {
      const output = smokeFileArg.slice(15)
      progress('student-screenshot')
      const screenshot = await deadline(() => window.webContents.capturePage(), 10000, stage)
      fs.writeFileSync(output + '.png', screenshot.toPNG())
      smokeRecord({...result, stage:'complete'})
    }
    app.quit()
  }
}

async function exportDiagnostics() {
  const choice = await dialog.showSaveDialog(window, {defaultPath:'expert-diagnostics.json',
    filters:[{name:'诊断', extensions:['json']}]})
  if (choice.canceled) return false
  // Strict allowlist: no database, logs, paths, conversations, credentials or tokens.
  const value = JSON.parse(fs.readFileSync(path.join(app.getPath('userData'), 'desktop-status.json'), 'utf8'))
  fs.writeFileSync(choice.filePath, JSON.stringify(value, null, 2))
  return true
}

async function inject() {
  window = new BrowserWindow(options('inject-preload.cjs'))
  const file = path.join(__dirname, 'inject.html')
  restrict(window, () => false)
  Menu.setApplicationMenu(null)
  ipcMain.handle('expert:credential', async (event, input) => {
    if (event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame ||
        event.senderFrame.url !== require('node:url').pathToFileURL(file).href) throw new Error('Invalid sender')
    let value
    try { value = validateCredential(input) } catch (error) { return {saved:false, message:error.message} }
    const choice = await dialog.showSaveDialog(window, {defaultPath:'demo-credential.json'})
    if (choice.canceled) return {saved:false, message:'已取消，未保存。'}
    fs.writeFileSync(choice.filePath, JSON.stringify(value), {mode:0o600})
    return {saved:true, message:'已保存私有凭据文件。请使用私有构建入口选择该文件；审核后逐条撤销。'}
  })
  await window.loadFile(file)
}
