// Fail closed on packaged credentials and accidental expert-edition resources.
const fs = require('node:fs')
const path = require('node:path')
const asar = require('../../desktop/node_modules/@electron/asar')
const root = process.argv[2]
const archive = path.join(root,'resources','app.asar')
const forbidden = /(^|[/\\])(\.env(?:\..*)?|demo-credential\.json|ai-settings\.enc(?:\.tmp)?|identity\.json|dev\.db|expert\.db|graph\.sqlite3)$/i
function walk(dir) {
  for (const e of fs.readdirSync(dir,{withFileTypes:true})) {
    const file = path.join(dir,e.name)
    if (e.isSymbolicLink()) throw new Error('Unexpected packaged symlink')
    if (file.replaceAll('\\','/').includes('/content/simulation/assets/')) throw new Error('Non-runtime art sources forbidden')
    if (forbidden.test(file)) throw new Error('Forbidden private file in public package')
    if (e.isDirectory()) walk(file)
  }
}
walk(root)
if (fs.existsSync(path.join(root,'resources','credential'))) throw new Error('Credential directory forbidden')
const names = asar.listPackage(archive)
if (names.some(n => forbidden.test(n) || /[/\\]inject[^/\\]*$/.test(n))) throw new Error('Private injector or credential in ASAR')
const pkg = JSON.parse(asar.extractFile(archive,'package.json').toString())
if (pkg.publicEdition !== true || pkg.name !== 'foreign-trade-public') throw new Error('Public identity missing')
fs.writeFileSync(path.join(path.dirname(root),'public-package-audit.json'), JSON.stringify({status:'PASS', checks:['public-identity','no-credential-directory','no-private-injector','no-known-private-files','no-art-source-directory'],time:new Date().toISOString()},null,2))
console.log('PASS: public identity, credential exclusion and no art sources')
