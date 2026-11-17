import test from 'node:test'
import assert from 'node:assert/strict'
import { groupReadNotice } from './group-read-notice.ts'

test('reads the chat server group read notice in the shapes the SDKs deliver', () => {
  const data = JSON.stringify({ conversationID: 'sg_g1', readerID: 'bob', hasReadSeq: 9 })
  assert.deepEqual(groupReadNotice(JSON.stringify({ key: 'group_read_progress', data })), { conversationID: 'sg_g1' })
  assert.deepEqual(groupReadNotice({ key: 'group_read_progress', data }), { conversationID: 'sg_g1' })
  assert.deepEqual(groupReadNotice({ key: 'group_read_progress', data: { conversationID: 'sg_g1' } }), { conversationID: 'sg_g1' })
})

test('ignores other business messages and malformed notices', () => {
  assert.equal(groupReadNotice({ key: 'other', data: JSON.stringify({ conversationID: 'sg_g1' }) }), undefined)
  assert.equal(groupReadNotice({ key: 'group_read_progress', data: JSON.stringify({ conversationID: 'si_a_b' }) }), undefined)
  assert.equal(groupReadNotice({ key: 'group_read_progress', data: '{not json' }), undefined)
  assert.equal(groupReadNotice('not json'), undefined)
  assert.equal(groupReadNotice(null), undefined)
})
