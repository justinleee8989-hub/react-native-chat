import assert from 'node:assert/strict'
import test from 'node:test'
import { isInvalidSDKLoginError } from './sdk-login-error.ts'

test('only explicit OpenIM token expired or invalid codes are terminal auth errors', () => {
  assert.equal(isInvalidSDKLoginError({ code: '1501' }), true)
  assert.equal(isInvalidSDKLoginError({ errCode: 1502 }), true)
  assert.equal(isInvalidSDKLoginError(new Error('network token invalid')), false)
  assert.equal(isInvalidSDKLoginError({ code: 'ECONNRESET', message: 'offline' }), false)
  assert.equal(isInvalidSDKLoginError({ code: '401' }), false)
})
