import assert from 'node:assert/strict'
import test from 'node:test'
import { trimMessageCache } from './message-cache.ts'
const messages = n => Array.from({ length: n }, (_, i) => ({ clientMsgID: String(i), sendTime: n - i, status: 2, contentType: 101 }))
test('keeps active history intact and trims only inactive histories', () => {
  const source = { active: messages(100), old: messages(80) }
  const result = trimMessageCache(source, 'active', ['old', 'active'])
  assert.equal(result.messages.active, source.active)
  assert.equal(result.messages.old.length, 30)
  assert.deepEqual(result.truncated, ['old'])
})
test('evicts least recently used ordinary chats but protects unsent/failed messages', () => {
  const source = Object.fromEntries(Array.from({ length: 55 }, (_, i) => [String(i), messages(1)]))
  source['0'][0].status = 1
  source['1'][0].status = 3
  const result = trimMessageCache(source, '2', Object.keys(source))
  assert.ok(result.messages['0'])
  assert.ok(result.messages['1'])
  assert.ok(result.messages['2'])
  assert.equal(result.messages['3'], undefined)
  assert.equal(Object.keys(result.messages).length, 50)
})
test('no-op pruning preserves reference identity', () => {
  const source = { a: messages(3) }
  assert.equal(trimMessageCache(source, 'a', ['a']).messages, source)
})
