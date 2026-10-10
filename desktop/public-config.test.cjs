const {test} = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const crypto = require('node:crypto')
const {validatePublicConfig,storeConfig,loadConfig} = require('./public-config.cjs')
test('one public key is accepted; whitespace and missing model are rejected', () => {
  assert.equal(validatePublicConfig({key:'test-only-key',model:'test-model'}).key,'test-only-key')
  assert.throws(() => validatePublicConfig({key:'bad key',model:'test-model'}))
  assert.throws(() => validatePublicConfig({key:'test-only-key',model:''}))
})
test('encrypted settings roundtrip; unavailable encryption leaves prior settings intact', () => {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'public-settings-test-'))
  const file=path.join(dir,'settings.enc'), key=crypto.randomBytes(32),iv=crypto.randomBytes(16)
  const encryption={isEncryptionAvailable:()=>true,
    encryptString:s=>{const c=crypto.createCipheriv('aes-256-cbc',key,iv);return Buffer.concat([c.update(s),c.final()])},
    decryptString:b=>{const c=crypto.createDecipheriv('aes-256-cbc',key,iv);return Buffer.concat([c.update(b),c.final()]).toString()}}
  try {
    const value={key:'synthetic-not-real',model:'test-model'}
    storeConfig(file,value,encryption)
    assert.equal(fs.readFileSync(file).includes(Buffer.from(value.key)),false)
    assert.equal(loadConfig(file,encryption).key,value.key)
    const before=fs.readFileSync(file)
    assert.throws(()=>storeConfig(file,value,{isEncryptionAvailable:()=>false}))
    assert.deepEqual(fs.readFileSync(file),before)
    fs.writeFileSync(file,'corrupt')
    assert.throws(()=>loadConfig(file,encryption))
  } finally {fs.rmSync(dir,{recursive:true,force:true})}
})
