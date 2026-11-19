import assert from 'node:assert/strict'
import test from 'node:test'
import { changePassword } from './password-api.ts'
test('password change uses ChatServer token, explicit self ID and MD5 secrets', async () => {
  let called = 0
  await changePassword({ userID: 'alice', chatToken: 'chat', imToken: 'im' }, 'old', 'new', 'http://localhost/', async (url, options) => {
    called++
    assert.equal(url, 'http://localhost/account/password/change')
    assert.equal(options.headers.token, 'chat')
    assert.deepEqual(JSON.parse(options.body), { userID: 'alice', currentPassword: '149603e6c03516362a8da23f624db945', newPassword: '22af645d1859cb5ca6da0c484f1f37ea' })
    return { ok: true, json: async () => ({ errCode: 0 }) }
  })
  assert.equal(called, 1)
})
test('legacy sessions and invalid password never reach network', async () => {
  const request = async () => { throw new Error('network called') }
  await assert.rejects(changePassword({ userID: 'alice', imToken: 'im' }, 'old', 'new', '', request), /重新登录/)
  await assert.rejects(changePassword({ userID: 'alice', chatToken: 'chat' }, 'old', 'old', '', request), /不同/)
})
test('a wrong current password is said as such; other rejections keep their code', async () => {
  await assert.rejects(changePassword({ userID: 'alice', chatToken: 'chat' }, 'old', 'new', '', async () => ({ ok: true, json: async () => ({ errCode: 20001, errMsg: 'PasswordError' }) })), error => error.key === 'password.currentWrong')
  await assert.rejects(changePassword({ userID: 'alice', chatToken: 'chat' }, 'old', 'new', '', async () => ({ ok: true, json: async () => ({ errCode: 1002, errMsg: 'NoPermissionError' }) })), error => error.errCode === 1002)
})

test('malformed password response is not success', async () => {
  await assert.rejects(changePassword({ userID: 'alice', chatToken: 'chat' }, 'old', 'new', '', async () => ({ ok: true, json: async () => ({}) })), /响应/)
})
