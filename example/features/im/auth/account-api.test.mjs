import assert from 'node:assert/strict'
import test from 'node:test'
import { createAccountService } from './account-api.ts'
test('unconfigured verification cannot claim code sent or mutate account', async () => {
  const service = createAccountService('', 5, false, async () => { throw new Error('network called') })
  await assert.rejects(service.sendCode('a@example.com', 'register', ''), /邮件验证/)
  await assert.rejects(service.submit({ mode: 'reset', email: 'a@example.com', code: '123', password: 'new' }), /邮件验证/)
})
test('email registration/reset preserve deployed ChatServer wire contract', async () => {
  const calls = []
  const service = createAccountService('http://localhost/', 5, true, async (url, options) => {
    calls.push([url, JSON.parse(options.body)])
    return { ok: true, json: async () => ({ errCode: 0 }) }
  })
  await service.sendCode('a@example.com', 'reset', '')
  assert.equal(calls[0][0], 'http://localhost/account/code/send')
  assert.equal(calls[0][1].usedFor, 2)
  await service.submit({ mode: 'register', email: 'a@example.com', code: '123', password: 'new', nickname: 'Alice', invitationCode: 'invite' })
  assert.equal(calls[1][0], 'http://localhost/account/register')
  assert.equal(calls[1][1].autoLogin, false)
  assert.equal(calls[1][1].user.password, '22af645d1859cb5ca6da0c484f1f37ea')
  assert.equal(calls[1][1].user.email, 'a@example.com')
  assert.equal(calls[1][1].invitationCode, 'invite')
  await service.submit({ mode: 'reset', email: 'a@example.com', code: '123', password: 'new' })
  assert.equal(calls[2][0], 'http://localhost/account/password/reset')
  assert.deepEqual(calls[2][1], { email: 'a@example.com', verifyCode: '123', password: '22af645d1859cb5ca6da0c484f1f37ea' })
})

test('malformed account responses and missing form fields are rejected', async () => {
  const service = createAccountService('', 5, true, async () => ({ ok: true, json: async () => ({}) }))
  await assert.rejects(service.sendCode('a@example.com', 'register', ''), /响应/)
  await assert.rejects(service.submit({ mode: 'register', email: 'a@example.com', code: '123', password: 'new', nickname: '' }), /昵称/)
})
