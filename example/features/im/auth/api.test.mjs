import assert from 'node:assert/strict'
import test from 'node:test'
import { authenticate } from './api.ts'
import { zhT } from '../i18n/test-modules.mjs'
import { errorMessage } from '../shared/error-message.ts'

test('login follows ChatServer email contract and retains both distinct tokens', async () => {
  const session = await authenticate('alice@example.com', 'OpenIM123!', 'http://localhost:10008/', 5, async (url, options) => {
    assert.equal(url, 'http://localhost:10008/account/login')
    const body = JSON.parse(options.body)
    assert.equal(body.email, 'alice@example.com')
    assert.equal(body.platform, 5)
    assert.match(body.password, /^[a-f0-9]{32}$/)
    assert.notEqual(body.password, 'OpenIM123!')
    return { ok: true, json: async () => ({ errCode: 0, data: { userID: 'alice', imToken: 'im-only', chatToken: 'chat-only' } }) }
  })
  assert.deepEqual(session, { userID: 'alice', imToken: 'im-only', chatToken: 'chat-only' })
})
test('login rejects incomplete success response instead of creating an invalid SDK session', async () => {
  await assert.rejects(authenticate('alice', 'password', 'http://local', 5, async () => ({ ok: true, json: async () => ({ data: { imToken: 'token' } }) })), /登录响应不完整/)
})
test('login surfaces backend rejection without storing credentials', async () => {
  // The server's wording is never shown: the failure is explained by its code.
  await assert.rejects(authenticate('alice', 'wrong', 'http://local', 5, async () => ({ ok: true, json: async () => ({ errCode: 1001, errMsg: '账号或密码错误' }) })), error => error.errCode === 1001)
})

test('login maps the backend PasswordError code to safe account credentials copy', async () => {
  await assert.rejects(
    authenticate('alice', 'wrong', 'http://local', 5, async () => ({
      ok: true,
      json: async () => ({ errCode: 20001, errMsg: 'PasswordError' }),
    })),
    error => errorMessage(error, zhT) === '账号或密码错误'
  )
})

for (const [kind, failure] of [
  ['React Native and the browser', () => new TypeError('Network request failed')],
  // expo/fetch, the global fetch on iOS and Android, rejects with a plain Error subclass.
  ['expo/fetch', () => new Error('fetch failed: 似乎已断开与互联网的连接。')],
]) {
  test(`a login that got no answer from ${kind}'s fetch says it could not reach the server, once`, async () => {
    let calls = 0
    await assert.rejects(
      authenticate('alice@example.com', 'pw', 'http://local', 1, async () => {
        calls++
        throw failure()
      }),
      error => errorMessage(error, zhT).startsWith('无法连接服务器')
    )
    // Never sent again: a first request that did reach the server would revoke the second one's token.
    assert.equal(calls, 1)
  })
}
test('a login with no answer within the timeout says it could not reach the server', async () => {
  const realTimeout = globalThis.setTimeout
  // The timeout fires at once; the request then rejects with an AbortError, as RN's fetch does.
  globalThis.setTimeout = (callback => realTimeout(callback, 0))
  try {
    await assert.rejects(
      authenticate('alice@example.com', 'pw', 'http://local', 1, (_url, options) => new Promise((_resolve, reject) => {
        options.signal.addEventListener('abort', () => reject(Object.assign(new Error('Aborted'), { name: 'AbortError' })))
      })),
      error => errorMessage(error, zhT).startsWith('无法连接服务器')
    )
  } finally {
    globalThis.setTimeout = realTimeout
  }
})
test('other errors are not taken for a missing answer', async () => {
  await assert.rejects(authenticate('alice', 'pw', 'http://local', 5, async () => {
    throw new Error('something else')
  }), /something else/)
})
