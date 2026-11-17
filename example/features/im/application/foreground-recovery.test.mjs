import assert from 'node:assert/strict'
import test from 'node:test'
import { createConversationRecovery } from './foreground-recovery.ts'

const context = {
  conversationID: 'group-a',
  generation: 2,
  session: { userID: 'me', imToken: 'im', chatToken: 'chat' },
}

test('coalesces concurrent recovery for one active session and conversation', async () => {
  let finishRefresh
  let refreshCalls = 0
  const history = []
  const recover = createConversationRecovery({
    isCurrent: () => true,
    refresh: async () => {
      refreshCalls++
      await new Promise(resolve => { finishRefresh = resolve })
    },
    loadHistory: async id => history.push(id),
  })
  const first = recover(context)
  const second = recover(context)
  await Promise.resolve()
  assert.equal(refreshCalls, 1)
  finishRefresh()
  await Promise.all([first, second])
  assert.deepEqual(history, ['group-a'])
})

test('does not load history after the session or active conversation changes during refresh', async () => {
  let current = true
  let finishRefresh
  const history = []
  const recover = createConversationRecovery({
    isCurrent: () => current,
    refresh: () => new Promise(resolve => { finishRefresh = resolve }),
    loadHistory: async id => history.push(id),
  })
  const request = recover(context)
  await Promise.resolve()
  current = false
  finishRefresh()
  await request
  assert.deepEqual(history, [])
})
