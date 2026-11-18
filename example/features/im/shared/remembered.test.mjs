import assert from 'node:assert/strict'
import test from 'node:test'
import { rememberedValue } from './remembered.ts'

test('a remembered value is read back only by the account that kept it', () => {
  const remembered = rememberedValue()
  assert.equal(remembered.get('a:token'), undefined)
  remembered.set('a:token', { friends: 3 })
  assert.deepEqual(remembered.get('a:token'), { friends: 3 })
  assert.equal(remembered.get('b:token'), undefined)
  remembered.set('b:token', { friends: 1 })
  assert.equal(remembered.get('a:token'), undefined, 'another account clears what was kept')
})
