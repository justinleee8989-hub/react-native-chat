import test from 'node:test'
import assert from 'node:assert/strict'
import { createComposerState, parseInputStatus } from './composer-state.ts'

function memory () {
  const values = new Map()
  return {
    values,
    mentions: new Map(),
    async read (userID, conversationID) { return values.get(`${userID}:${conversationID}`) ?? '' },
    async write (userID, conversationID, value) { values.set(`${userID}:${conversationID}`, value) },
    async readMentions (userID, conversationID) { return this.mentions.get(`${userID}:${conversationID}`) ?? [] },
    async writeMentions (userID, conversationID, value) { this.mentions.set(`${userID}:${conversationID}`, value) },
  }
}

test('drafts are scoped to user and conversation', async () => {
  const storage = memory()
  const state = createComposerState(storage)
  state.setUser('alice')
  await state.save('g1', 'alpha')
  await state.save('g2', 'beta')
  assert.equal(await state.restore('g1'), 'alpha')
  state.setUser('bob')
  assert.equal(await state.restore('g1'), '')
  await state.save('g1', 'other account')
  state.setUser('alice')
  assert.equal(await state.restore('g1'), 'alpha')
})

test('queued writes preserve order and stale user writes are skipped', async () => {
  let release
  let markStarted
  const first = new Promise(resolve => { release = resolve })
  const started = new Promise(resolve => { markStarted = resolve })
  const writes = []
  const storage = {
    async read () { return '' },
    async write (user, conversation, text) {
      writes.push(`${user}:${text}`)
      if (text === 'first') {
        markStarted()
        await first
      }
    },
  }
  const state = createComposerState(storage)
  state.setUser('alice')
  const earlier = state.save('c', 'first')
  await started
  const later = state.save('c', 'second')
  state.setUser('bob')
  const stale = state.save('c', 'stale')
  release()
  await Promise.all([earlier, later, stale])
  assert.deepEqual(writes, ['alice:first', 'bob:stale'])
})

test('send failure preserves draft; only successful send clears it', async () => {
  const storage = memory()
  const state = createComposerState(storage)
  state.setUser('alice')
  await state.save('c', 'keep me')
  await assert.rejects(state.send('c', async () => { throw new Error('failed') }))
  assert.equal(await state.restore('c'), 'keep me')
  await state.send('c', async () => 'sent')
  assert.equal(await state.restore('c'), '')
})

test('send completion after account switch does not clear the new account draft', async () => {
  const storage = memory()
  const state = createComposerState(storage)
  state.setUser('alice')
  await state.save('c', 'alice draft')
  let finishSend
  const pending = state.send('c', () => new Promise(resolve => { finishSend = resolve }))
  state.setUser('bob')
  await state.save('c', 'bob draft')
  finishSend('sent')
  await pending
  assert.equal(await state.restore('c'), 'bob draft')
})

test('send completion does not clear text typed while sending', async () => {
  const storage = memory()
  const state = createComposerState(storage)
  state.setUser('alice')
  await state.save('c', 'submitted')
  let finishSend
  const pending = state.send('c', () => new Promise(resolve => { finishSend = resolve }))
  await state.save('c', 'new text')
  finishSend('sent')
  await pending
  assert.equal(await state.restore('c'), 'new text')
})

test('mention selections restore per account and conversation and clear only after successful send', async () => {
  const storage = memory()
  const state = createComposerState(storage)
  state.setUser('alice')
  await state.saveMentions('g', ['member-a'])
  assert.deepEqual(await state.restoreMentions('g'), ['member-a'])
  assert.deepEqual(await state.restoreMentions('other-group'), [])
  state.setUser('bob')
  assert.deepEqual(await state.restoreMentions('g'), [])
  state.setUser('alice')
  await assert.rejects(state.send('g', async () => { throw new Error('failed') }))
  assert.deepEqual(await state.restoreMentions('g'), ['member-a'])
  await state.send('g', async () => 'sent')
  assert.deepEqual(await state.restoreMentions('g'), [])
})

test('mention changes during send are not cleared by the older send', async () => {
  const storage = memory()
  const state = createComposerState(storage)
  state.setUser('alice')
  await state.saveMentions('g', ['member-a'])
  let finishSend
  const pending = state.send('g', () => new Promise(resolve => { finishSend = resolve }))
  await state.saveMentions('g', ['member-b'])
  finishSend('sent')
  await pending
  assert.deepEqual(await state.restoreMentions('g'), ['member-b'])
})

test('exit immediately after clearing flushes the empty draft instead of keeping stale text', async () => {
  const storage = memory()
  const state = createComposerState(storage)
  state.setUser('alice')
  await state.save('c', 'old draft')
  await state.flushOnExit('alice', 'c', '', false)
  assert.equal(await state.restore('c'), '')
})

test('exit during a send does not flush the pre-send empty reset over the draft', async () => {
  const storage = memory()
  const state = createComposerState(storage)
  state.setUser('alice')
  await state.save('c', 'submitted draft')
  await state.flushOnExit('alice', 'c', '', true)
  assert.equal(await state.restore('c'), 'submitted draft')
})

test('exit flush from an old login cannot write into the current account', async () => {
  const storage = memory()
  const state = createComposerState(storage)
  state.setUser('alice')
  await state.save('c', 'alice draft')
  state.setUser('bob')
  await state.flushOnExit('alice', 'c', '', false)
  assert.equal(await state.restore('c'), '')
})

test('input status accepts native and WASM payload shapes and rejects malformed events', () => {
  const status = { conversationID: 'group-conversation', userID: 'member', platformIDs: [5] }
  assert.deepEqual(parseInputStatus(status), status)
  assert.deepEqual(parseInputStatus({ data: status }), status)
  assert.deepEqual(parseInputStatus(JSON.stringify(status)), status)
  assert.equal(parseInputStatus('not json'), null)
  assert.equal(parseInputStatus({ conversationID: 'g', userID: 'u' }), null)
})

for (const failedPart of ['write', 'writeMentions'])
  test(`delivered send survives ${failedPart} cleanup failure without restoring submitted draft`, async () => {
    const storage = memory()
    const state = createComposerState(storage)
    state.setUser('alice')
    await state.save('c', 'delivered text')
    await state.saveMentions('c', ['member'])
    storage[failedPart] = async () => { throw new Error('storage offline') }
    const warnings = []
    assert.equal(await state.send('c', async () => 'delivered', error => warnings.push(error)), 'delivered')
    assert.equal(warnings.length, 1)
    await state.flushOnExit('alice', 'c', '', false).catch(() => undefined)
    await state.saveMentions('c', []).catch(() => undefined)
    assert.equal(await state.restore('c'), '')
    assert.deepEqual(await state.restoreMentions('c'), [])
  })

test('cleanup failure preserves a newer draft and reports no warning to a new account', async () => {
  const storage = memory()
  const state = createComposerState(storage)
  state.setUser('alice')
  await state.save('c', 'submitted')
  let rejectCleanup
  let started
  const waiting = new Promise(resolve => { started = resolve })
  const write = storage.write
  storage.write = async (...args) => {
    if (args[2] === '') {
      started()
      await new Promise((_resolve, reject) => { rejectCleanup = reject })
    } else await write(...args)
  }
  const warnings = []
  const sent = state.send('c', async () => 'delivered', error => warnings.push(error))
  await waiting
  const newer = state.save('c', 'new draft')
  rejectCleanup(new Error('cleanup failed'))
  await sent
  await newer
  assert.equal(await state.restore('c'), 'new draft')
  const second = state.send('c', async () => 'delivered', error => warnings.push(error))
  await new Promise(resolve => setImmediate(resolve))
  state.setUser('bob')
  rejectCleanup(new Error('stale cleanup failed'))
  await second
  assert.equal(warnings.length, 1)
})

test('durable delivered marker survives restart when SDK cleanup fails', async () => {
  const storage = memory()
  let delivered = false
  storage.clearDelivered = async () => { delivered = true }
  const read = storage.read
  storage.read = async (...args) => delivered ? '' : read(...args)
  const first = createComposerState(storage)
  first.setUser('alice')
  await first.save('c', 'delivered')
  storage.write = async () => { throw Error('SDK offline') }
  await first.send('c', async () => 'sent')
  const restarted = createComposerState(storage)
  restarted.setUser('alice')
  assert.equal(await restarted.restore('c'), '')
})

test('same user on a different server does not share delivered markers or stale exit writes', async () => {
  let scope = 'one'
  const storage = memory()
  storage.getScope = () => scope
  const state = createComposerState(storage)
  state.setUser('alice')
  await state.save('c', 'first')
  await state.send('c', async () => 'sent')
  scope = 'two'
  await storage.write('alice', 'c', 'second server draft')
  state.setUser('alice')
  assert.equal(await state.restore('c'), 'second server draft')
  await state.flushOnExit('alice', 'c', 'stale first server', false, 'one')
  assert.equal(await state.restore('c'), 'second server draft')
})

test('queued draft work is invalidated when scope changes before hook updates', async () => {
  let scope = 'one'
  const writes = []
  const state = createComposerState({ getScope: () => scope, read: async () => '', write: async (_u, _c, text) => { writes.push(text) } })
  state.setUser('alice')
  const pending = state.save('c', 'old scope')
  scope = 'two'
  await pending
  assert.deepEqual(writes, [])
})

test('rapid typing coalesces obsolete queued drafts before delivered cleanup', async () => {
  let release
  let started
  const startedPromise = new Promise(resolve => { started = resolve })
  const blocked = new Promise(resolve => { release = resolve })
  const writes = []
  const state = createComposerState({ read: async () => '', write: async (_u, _c, text) => {
    writes.push(text)
    if (text === 'first') { started(); await blocked }
  } })
  state.setUser('qa')
  const first = state.save('chat', 'first')
  await startedPromise
  const pending = Array.from({ length: 100 }, (_, index) => state.save('chat', `typed-${index}`))
  release()
  await Promise.all([first, ...pending])
  assert.deepEqual(writes, ['first', 'typed-99'])
  await state.send('chat', async () => 'sent')
  assert.equal(writes.at(-1), '')
})
