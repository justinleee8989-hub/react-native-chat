import assert from 'node:assert/strict'
import test from 'node:test'
import { endWebSession } from './web-session.ts'

test('web logout waits for SDK and replaces the runtime without deleting stored history', async () => {
  const order = []
  await endWebSession(async () => { order.push('logout') }, () => order.push('reload'))
  assert.deepEqual(order, ['logout', 'reload'])
})

test('failed SDK logout still isolates the next account', async () => {
  let reloaded = false
  await assert.rejects(endWebSession(async () => { throw new Error('timeout') }, () => { reloaded = true }), /timeout/)
  assert.equal(reloaded, true)
})
