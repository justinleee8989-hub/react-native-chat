import assert from 'node:assert/strict'
import test from 'node:test'
import { authenticate } from './api.ts'

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
  await assert.rejects(authenticate('alice', 'wrong', 'http://local', 5, async () => ({ ok: true, json: async () => ({ errCode: 1001, errMsg: '账号或密码错误' }) })), /账号或密码错误/)
})

test('login maps the backend PasswordError code to safe account credentials copy', async () => {
  await assert.rejects(
    authenticate('alice', 'wrong', 'http://local', 5, async () => ({
      ok: true,
      json: async () => ({ errCode: 20001, errMsg: 'PasswordError' }),
    })),
    /账号或密码错误/
  )
})
