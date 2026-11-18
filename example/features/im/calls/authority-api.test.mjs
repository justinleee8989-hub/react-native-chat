import assert from 'node:assert/strict'
import test from 'node:test'
import { callAuthority } from './authority-api.ts'
import { isCallServiceUnavailable } from './errors.ts'

const session = { userID: 'me', imToken: 'im', chatToken: 'chat' }
function answer (body) {
  globalThis.fetch = async () => ({ ok: true, json: async () => body })
}

test('a server without a call service is reported as such, not as a generic failure', async () => {
  answer({ errCode: 1002, errMsg: 'NoPermissionError', errDlt: '通话服务未启用' })
  await assert.rejects(callAuthority(session, 'http://chat', { action: 'list' }), isCallServiceUnavailable)
})

test('other authority errors keep their message', async () => {
  answer({ errCode: 1002, errMsg: 'NoPermissionError', errDlt: 'room closed' })
  await assert.rejects(callAuthority(session, 'http://chat', { action: 'list' }), error => !isCallServiceUnavailable(error) && error.message === 'NoPermissionError')
})
