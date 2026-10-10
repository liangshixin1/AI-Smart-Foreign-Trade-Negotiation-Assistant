const {test} = require('node:test')
const assert = require('node:assert/strict')
const {deadline} = require('./deadline.cjs')
test('unresponsive renderer operation rejects within its deadline', async () => {
  await assert.rejects(deadline(() => new Promise(() => {}), 20, 'renderer'),
    {name:'OperationTimeout', message:'renderer'})
})
test('successful and failed operations preserve their results', async () => {
  assert.equal(await deadline(() => 42, 1000, 'value'), 42)
  await assert.rejects(deadline(() => { throw new TypeError('failed') }, 1000, 'value'), TypeError)
})
