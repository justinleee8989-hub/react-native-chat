import test from 'node:test'
import assert from 'node:assert/strict'
import { CallServiceUnavailableError, callError, isCallServiceUnavailable, safeCallErrorMessage } from './errors.ts'
test('missing hardware and permission errors are actionable Chinese messages', () => {
 assert.match(callError({name:'NotFoundError',message:'Requested device not found'}).message, /未检测到/)
 assert.match(callError({name:'NotAllowedError'}).message, /权限/)
 assert.match(callError({name:'NotReadableError'}).message, /占用/)
 assert.equal(callError(new Error('服务连接失败')).message, '服务连接失败')
})
test('call error details keep useful context while removing credentials', () => {
 const jwt = 'eyJhbGciOiJub25lIn0.eyJzdWIiOiJ1c2VyIn0.signaturevalue123'
 const message = safeCallErrorMessage(new Error(`send failed Bearer ${jwt}`))
 assert.match(message, /send failed/)
 assert.doesNotMatch(message, /signaturevalue123|eyJhbGci/)
 assert.match(message, /凭据已隐藏/)
})
test('missing or forbidden call rooms have a readable label', () => {
 assert.equal(safeCallErrorMessage(new Error('NoPermissionError')), '通话已不可用或无权加入')
})
test('a missing call service is recognised and explained', () => {
 const error = new CallServiceUnavailableError()
 assert.equal(isCallServiceUnavailable(error), true)
 assert.equal(isCallServiceUnavailable(new Error('通话服务未启用')), false)
 assert.match(error.message, /通话服务未启用/)
})
