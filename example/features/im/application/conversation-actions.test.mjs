import assert from 'node:assert/strict'
import test from 'node:test'
import { createConversationActions } from './conversation-actions.ts'
import { isConversationArchived, updateConversationArchiveEx } from '../domain/conversation-archive.ts'
function runtime () {
  const value = { generation: 1, activeID: 'c', state: { session: { userID: 'alice' }, conversations: [{ conversationID: 'c', showName: 'Bob' }], messages: { c: [{ clientMsgID: 'm' }] }, historyEnd: { c: true } } }
  value.update = patch => { value.state = { ...value.state, ...patch } }
  return value
}
test('failed remote pin does not show a false successful local setting', async () => {
  const rt = runtime()
  const actions = createConversationActions(rt, { pin: async () => { throw new Error('permission denied') } })
  await assert.rejects(actions.setPinned(['c'], true), /permission denied/)
  assert.equal(rt.state.conversations[0].isPinned, undefined)
})
test('late setting result cannot alter a new account', async () => {
  const rt = runtime()
  let finish
  const actions = createConversationActions(rt, { mute: async () => new Promise(resolve => { finish = resolve }) })
  const operation = actions.setMuted(['c'], true)
  rt.generation++
  finish()
  await operation
  assert.equal(rt.state.conversations[0].recvMsgOpt, undefined)
})
test('delete removes local conversation and messages only after remote success', async () => {
  const rt = runtime()
  const actions = createConversationActions(rt, { remove: async () => {} })
  await actions.removeConversations(['c'])
  assert.equal(rt.state.conversations.length, 0)
  assert.equal(rt.state.messages.c, undefined)
  assert.equal(rt.state.historyEnd.c, undefined)
  assert.equal(rt.activeID, '')
})

test('retry after partial batch deletion skips conversations already removed successfully', async () => {
  const rt = runtime()
  rt.state.conversations.push({ conversationID: 'd', showName: 'Charlie' })
  const calls = []
  let fail = true
  const actions = createConversationActions(rt, { remove: async id => {
    calls.push(id)
    if (id === 'd' && fail) throw new Error('disconnected')
  } })
  await assert.rejects(actions.removeConversations(['c', 'd']), /disconnected/)
  fail = false
  await actions.removeConversations(['c', 'd'])
  assert.deepEqual(calls, ['c', 'd', 'd'])
})

test('archive updates the current user ex after remote success and unpins the conversation', async () => {
  const rt = runtime()
  rt.state.conversations[0].conversationID = 'si_group-1'
  rt.state.conversations[0].groupID = 'group-1'
  rt.state.conversations[0].conversationType = 3
  rt.state.conversations[0].ex = '{"other":"keep"}'
  rt.state.conversations[0].isPinned = true
  let archivedEx
  const actions = createConversationActions(rt, { archive: async (id, ex, userID, archived, sessionType, sourceID) => {
    assert.equal(id, 'si_group-1')
    assert.equal(ex, '{"other":"keep"}')
    assert.equal(userID, 'alice')
    assert.equal(archived, true)
    assert.equal(sessionType, 3)
    assert.equal(sourceID, 'group-1')
    archivedEx = updateConversationArchiveEx(ex, userID, archived)
    return archivedEx
  } })

  await actions.setArchived(['si_group-1'], true)
  assert.equal(rt.state.conversations[0].ex, archivedEx)
  assert.equal(rt.state.conversations[0].isPinned, false)
  assert.equal(isConversationArchived(rt.state.conversations[0].ex, 'alice'), true)
})
