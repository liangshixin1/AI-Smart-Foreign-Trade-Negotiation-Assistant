const {test} = require('node:test')
const assert = require('node:assert/strict')
const {allowedLocalUrl, validateCredential} = require('./security.cjs')
test('loopback token is only attached to the exact launch origin', () => {
  const origin = 'http://127.0.0.1:12345'
  assert.equal(allowedLocalUrl(origin + '/api', origin), true)
  for (const value of ['https://evil.test', 'http://127.0.0.1:12346', 'file:///tmp/a',
    'http://127.0.0.1:12345.evil.test', 'invalid']) {
    assert.equal(allowedLocalUrl(value, origin), false)
  }
})
test('private build validates three distinct keys, expiry and budget', () => {
  const input = {scenario:'one', conversation:'two', evaluation:'three',
    expires_at:'2099-01-01T00:00:00Z', model:'test-model', budget_confirmed:true}
  assert.equal(validateCredential(input).schema_version, 1)
  for (const patch of [{conversation:'one'}, {scenario:''}, {expires_at:'2000-01-01T00:00:00Z'},
    {budget_confirmed:false}, {model:''}]) {
    assert.throws(() => validateCredential({...input,...patch}))
  }
})
