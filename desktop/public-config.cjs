const fs = require('node:fs')
const path = require('node:path')
function validatePublicConfig(value) {
  const model = typeof value?.model === 'string' ? value.model.trim() : ''
  const key = typeof value?.key === 'string' ? value.key.trim() : ''
  if (!key || key.length > 1024 || /\s/.test(key)) throw new Error('请填写有效的 API Key。')
  if (!model || model.length > 100 || /\s/.test(model)) throw new Error('请填写模型 API 名称。')
  return {schema_version:1, key, model}
}
function storeConfig(file, input, encryption) {
  const value = validatePublicConfig(input)
  if (!encryption.isEncryptionAvailable()) throw new Error('系统加密存储不可用，未保存 Key。')
  const encrypted = encryption.encryptString(JSON.stringify(value))
  fs.mkdirSync(path.dirname(file), {recursive:true})
  const tmp = file + '.tmp'
  fs.writeFileSync(tmp, encrypted, {mode:0o600})
  fs.renameSync(tmp, file)
}
function loadConfig(file, encryption) {
  if (!fs.existsSync(file)) return null
  if (!encryption.isEncryptionAvailable()) throw new Error('系统加密存储不可用。')
  return validatePublicConfig(JSON.parse(encryption.decryptString(fs.readFileSync(file))))
}
module.exports = {validatePublicConfig, storeConfig, loadConfig}
