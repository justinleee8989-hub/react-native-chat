import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

function service (fetch) {
  const exports = {}
  runInNewContext(ts.transpileModule(readFileSync(new URL('./server-history.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, { exports, fetch, AbortController, setTimeout, clearTimeout, Date, Error })
  return exports.fetchServerHistory
}
const session = { chatToken: 'test-only-token' }

test('empty filtered page retains continuation cursor and uses user token', async () => {
  let body
  const load = service(async (url, options) => {
    assert.equal(url, 'http://local/user/message/history')
    assert.equal(options.headers.token, session.chatToken)
    body = JSON.parse(options.body)
    return { ok: true, json: async () => ({ errCode: 0, data: { messages: [], hasMore: true, cursor: 'older' } }) }
  })
  const page = await load(session, 'http://local/', { conversationID: 'group', query: 'needle', cursor: 'newer' })
  assert.equal(page.hasMore, true)
  assert.equal(page.cursor, 'older')
  assert.equal(body.cursor, 'newer')
  assert.equal(body.query, 'needle')
})
test('permission failures and stalled/malformed pages fail instead of silently exhausting', async () => {
  for (const result of [
    { errCode: 1002, errMsg: 'denied' },
    { errCode: 0, data: { messages: [], hasMore: true, cursor: 'same' } },
    { errCode: 0, data: { messages: [], hasMore: true, cursor: '' } },
    { errCode: 0, data: { messages: null, hasMore: false, cursor: '' } },
  ]) {
    const load = service(async () => ({ ok: true, json: async () => result }))
    await assert.rejects(load(session, 'http://local', { conversationID: 'group', cursor: 'same' }))
  }
})
test('no credentials do not dispatch a request', async () => {
  const load = service(async () => assert.fail('must not fetch'))
  await assert.rejects(load({}, 'http://local', { conversationID: 'group' }))
})
