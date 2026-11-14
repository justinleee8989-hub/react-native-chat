import test from 'node:test'
import assert from 'node:assert/strict'
import { assertMediaReplyAllowed } from './composer.ts'

test('media cannot silently discard an active quote', () => {
  assert.throws(() => assertMediaReplyAllowed({ _id: 'original' }), /取消引用/)
  assert.doesNotThrow(() => assertMediaReplyAllowed(null))
})
