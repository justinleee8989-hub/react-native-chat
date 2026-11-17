import assert from 'node:assert/strict'
import test from 'node:test'
import { watchHomeSnapshot } from './home-persistence.ts'
import { createHomeSnapshots } from '../infrastructure/storage/home-snapshot.ts'

test('required flush cancels debounce and follows an already running stale write', async () => {
  const config = { api: 'qa', ws: 'qa', chat: 'qa' }
  const row = { conversationID: 'qa-only', conversationType: 1, showName: 'QA', unreadCount: 0 }
  const data = new Map()
  let release
  let started
  const firstStarted = new Promise(resolve => { started = resolve })
  let count = 0
  const cache = createHomeSnapshots({ getItem: async key => data.get(key) ?? null, removeItem: async key => { data.delete(key) }, setItem: async (key, value) => {
    count++
    if (count === 1) await new Promise(resolve => { release = resolve; started() })
    data.set(key, value)
  } })
  const listeners = new Set()
  const runtime = { state: { session: { userID: 'qa' }, config, conversationsLoaded: true, conversations: [row] }, subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener) } }
  const writer = watchHomeSnapshot(runtime, cache, 'qa', config)
  const old = cache.save('qa', config, [row])
  await firstStarted
  runtime.state.conversations = []
  listeners.forEach(listener => listener())
  let settled = false
  const flushing = writer.flush().then(() => { settled = true })
  await Promise.resolve()
  assert.equal(settled, false)
  release()
  await old
  await flushing
  assert.deepEqual((await cache.load('qa', config)).conversations, [])
  await new Promise(resolve => setTimeout(resolve, 300))
  assert.equal(count, 2)
  writer.stop()
})
