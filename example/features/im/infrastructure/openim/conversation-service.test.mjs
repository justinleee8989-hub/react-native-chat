import assert from 'node:assert/strict'
import test from 'node:test'
import { createConversationService } from './conversation-service.ts'
import { isConversationArchived } from '../../domain/conversation-archive.ts'

test('pin and mute use separate OpenIM fields; unmute restores normal receiving', async () => {
  const calls = []
  const service = createConversationService(async () => ({ setConversation: async value => calls.push(value) }))
  await service.pin('c', true)
  await service.mute('c', true)
  await service.mute('c', false)
  assert.deepEqual(calls, [{ conversationID: 'c', isPinned: true }, { conversationID: 'c', recvMsgOpt: 2 }, { conversationID: 'c', recvMsgOpt: 0 }])
})
test('clear history and delete conversation remain distinct operations', async () => {
  const calls = []
  const service = createConversationService(async () => ({ clearConversationAndDeleteAllMsg: async id => calls.push(['clear', id]), deleteConversationAndDeleteAllMsg: async id => calls.push(['delete', id]) }))
  await service.clear('c')
  await service.remove('c')
  assert.deepEqual(calls, [['clear', 'c'], ['delete', 'c']])
})

test('archive persists per-user metadata in conversation ex and unpins only when archiving', async () => {
  const calls = []
  const service = createConversationService(async () => ({ setConversation: async value => calls.push(value) }))
  const ex = await service.archive('c', '{"custom":"keep"}', 'alice', true)
  assert.deepEqual(calls[0], { conversationID: 'c', ex, isPinned: false })
  assert.equal(JSON.parse(ex).custom, 'keep')
  assert.equal(isConversationArchived(ex, 'alice'), true)
  const unarchived = await service.archive('c', ex, 'alice', false)
  assert.deepEqual(calls[1], { conversationID: 'c', ex: unarchived })
  assert.equal(isConversationArchived(unarchived, 'alice'), false)
})

test('archive merges metadata into the latest SDK ex for the conversation type', async () => {
  const calls = []
  const service = createConversationService(
    async () => ({ setConversation: async value => calls.push(value) }),
    async (sourceID, sessionType) => {
      assert.equal(sourceID, 'group-1')
      assert.equal(sessionType, 3)
      return { ex: '{"changedElsewhere":"keep"}' }
    },
  )
  const ex = await service.archive('si_group-1', '{"stale":"drop"}', 'alice', true, 3, 'group-1')
  assert.equal(JSON.parse(ex).changedElsewhere, 'keep')
  assert.equal(JSON.parse(ex).stale, undefined)
  assert.equal(calls[0].conversationID, 'si_group-1')
  assert.equal(calls[0].ex, ex)
})

test('archive honors an explicitly cleared latest ex instead of restoring stale metadata', async () => {
  const service = createConversationService(
    async () => ({ setConversation: async () => {} }),
    async () => ({}),
  )
  const ex = await service.archive('c', '{"stale":"drop"}', 'alice', true, 1, 'bob')
  assert.equal(JSON.parse(ex).stale, undefined)
  assert.equal(isConversationArchived(ex, 'alice'), true)
})
