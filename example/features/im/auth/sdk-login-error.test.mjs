import assert from 'node:assert/strict'
import test from 'node:test'
import { isInvalidSDKLoginError } from './sdk-login-error.ts'

test('only explicit OpenIM token error codes are terminal auth errors', () => {
  for (const code of ['1501', '1502', '1503', '1504', '1505', '1506', '1507'])
    assert.equal(isInvalidSDKLoginError({ code }), true, code)
  assert.equal(isInvalidSDKLoginError({ errCode: 1506 }), true)
  assert.equal(isInvalidSDKLoginError(new Error('network token invalid')), false)
  assert.equal(isInvalidSDKLoginError({ code: 'ECONNRESET', message: 'offline' }), false)
  assert.equal(isInvalidSDKLoginError({ code: '401' }), false)
  // Neighbouring server codes are not token errors.
  assert.equal(isInvalidSDKLoginError({ code: '1500' }), false)
  assert.equal(isInvalidSDKLoginError({ code: '1508' }), false)
})
