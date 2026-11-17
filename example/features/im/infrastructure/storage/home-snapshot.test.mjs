import assert from 'node:assert/strict'
import test from 'node:test'
import { createHomeSnapshots } from './home-snapshot.ts'
const config = { api: 'local-api', ws: 'local-ws', chat: 'local-chat' }
const conversation = { conversationID: 'one', conversationType: 1, showName: 'QA', unreadCount: 2 }
function fixture () {
  const data = new Map()
  return { data, cache: createHomeSnapshots({ getItem: async k => data.get(k) ?? null, setItem: async (k, v) => { data.set(k, v) }, removeItem: async k => { data.delete(k) } }) }
}
test('home snapshot is bounded, account/server scoped and contains no tokens', async () => {
  const { cache, data } = fixture()
  await cache.save('qa', config, Array.from({ length: 250 }, (_, i) => ({ ...conversation, conversationID: String(i) })))
  assert.equal((await cache.load('qa', config)).conversations.length, 200)
  assert.equal(await cache.load('other', config), undefined)
  assert.equal(await cache.load('qa', { ...config, api: 'other' }), undefined)
  assert.equal([...data.values()].some(v => v.includes('imToken')), false)
})
test('invalid snapshot and storage failures do not block authentication', async () => {
  const { cache, data } = fixture()
  await cache.save('qa', config, [conversation])
  for (const k of data.keys()) data.set(k, '{broken')
  assert.equal(await cache.load('qa', config), undefined)
  const failed = createHomeSnapshots({ getItem: async () => { throw Error('unavailable') }, setItem: async () => { throw Error('unavailable') }, removeItem: async () => {} })
  assert.equal(await failed.load('qa', config), undefined)
  await failed.save('qa', config, [conversation])
})
test('logout removal follows pending writes, so a queued snapshot cannot reappear', async () => {
  const { cache } = fixture()
  const write = cache.save('qa', config, [conversation])
  await cache.remove('qa', config)
  await write
  assert.equal(await cache.load('qa', config), undefined)
})

test('200 rows with long bounded previews fit the snapshot size budget', async () => {
  const { cache } = fixture()
  const rows = Array.from({ length: 200 }, (_, i) => ({ ...conversation, conversationID: String(i), latestMsg: 'x'.repeat(4096), ex: 'x'.repeat(4096) }))
  await cache.save('qa', config, rows)
  assert.equal((await cache.load('qa', config)).conversations.length, 200)
})

test('required save removes stale snapshot if replacing it fails', async () => {
  const data = new Map()
  let fail = false
  const cache = createHomeSnapshots({ getItem: async k => data.get(k) ?? null, setItem: async (k, v) => { if (fail) throw Error('quota'); data.set(k, v) }, removeItem: async k => { data.delete(k) } })
  await cache.save('qa', config, [conversation])
  fail = true
  await cache.save('qa', config, [], { required: true })
  assert.equal(await cache.load('qa', config), undefined)
})
test('required save reports failure when neither write nor removal is possible', async () => {
  const cache = createHomeSnapshots({ getItem: async () => null, setItem: async () => { throw Error('write blocked') }, removeItem: async () => { throw Error('remove blocked') } })
  await assert.rejects(cache.save('qa', config, [], { required: true }))
  await cache.save('qa', config, [])
})
