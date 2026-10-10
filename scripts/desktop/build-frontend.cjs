// Build the ordinary Vue app with explicit desktop-only flags, then attest its assets.
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const {spawnSync} = require('node:child_process')
const root = path.resolve(__dirname, '../..')
const web = path.join(root, 'apps/web')
const result = spawnSync(process.execPath, [path.join(web, 'node_modules/vite/bin/vite.js'), 'build'], {
  cwd:web, stdio:'inherit', env:{...process.env, VITE_API_BASE_URL:'', VITE_DESKTOP:'true'},
})
if (result.status !== 0) process.exit(result.status || 1)
const dist = path.join(web, 'dist')
const files = fs.readdirSync(path.join(dist, 'assets')).filter(name => name.endsWith('.js'))
const assets = files.map(name => {
  const data = fs.readFileSync(path.join(dist, 'assets', name))
  if (data.includes(Buffer.from('http://localhost:8000'))) throw new Error('Non-desktop API URL in bundle')
  return {path:'assets/' + name, sha256:crypto.createHash('sha256').update(data).digest('hex')}
})
fs.writeFileSync(path.join(dist, 'desktop-build.json'), JSON.stringify({
  desktop:true, apiBase:'same-origin', assets,
}, null, 2))
