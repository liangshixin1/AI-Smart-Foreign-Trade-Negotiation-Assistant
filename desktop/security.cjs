const crypto = require('node:crypto')

function allowedLocalUrl(value, origin) {
  try { return new URL(value).origin === origin } catch { return false }
}

function validateCredential(value, {allowExpired = false} = {}) {
  const roles = ['scenario', 'conversation', 'evaluation']
  if (!value || roles.some(role => typeof value[role] !== 'string' || !value[role].trim()) ||
      new Set(roles.map(role => value[role].trim())).size !== 3) {
    throw new Error('请填写三条不同的临时 Key。')
  }
  if (typeof value.model !== 'string' || !value.model.trim() || value.model.length > 100) {
    throw new Error('请填写账户可用的模型名称。')
  }
  if (!value.budget_confirmed || !Number.isFinite(Date.parse(value.expires_at)) ||
      (!allowExpired && Date.parse(value.expires_at) <= Date.now()) ||
      !/(Z|[+-]\d{2}:\d{2})$/.test(value.expires_at)) {
    throw new Error('请确认预算并填写带时区的未来到期时间。')
  }
  return {schema_version: 1, ...Object.fromEntries(roles.map(r => [r, value[r].trim()])),
    model: value.model.trim(), expires_at: value.expires_at, budget_confirmed: true,
    max_calls_per_launch: 100}
}

function digest(value) { return crypto.createHash('sha256').update(value).digest('hex') }
module.exports = {allowedLocalUrl, validateCredential, digest}
