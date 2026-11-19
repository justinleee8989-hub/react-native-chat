import test from 'node:test'
import assert from 'node:assert/strict'
import { zhT } from '../i18n/test-modules.mjs'
import { errorMessage } from '../shared/error-message.ts'
import { CallServiceUnavailableError, callError, isCallServiceUnavailable } from './errors.ts'
const shown = error => errorMessage(callError(error), zhT)
test('missing hardware and permission errors are actionable messages', () => {
 assert.match(shown({ name: 'NotFoundError', message: 'Requested device not found' }), /未检测到/)
 assert.match(shown({ name: 'NotAllowedError' }), /权限/)
 assert.match(shown({ name: 'NotReadableError' }), /占用/)
 assert.equal(shown(new Error('service down')), '通话操作失败，请重试')
})
test('a server or SDK failure keeps its code, and its wording is never shown', () => {
 const jwt = 'eyJhbGciOiJub25lIn0.eyJzdWIiOiJ1c2VyIn0.signaturevalue123'
 const message = shown(new Error(`send failed Bearer ${jwt}`))
 assert.doesNotMatch(message, /send failed|signaturevalue123|eyJhbGci/)
 assert.equal(shown({ errCode: 20203, errMsg: 'CallBusy' }), '对方正在通话中')
 assert.equal(shown({ errCode: 1002, errMsg: 'NoPermissionError' }), '当前账号没有权限执行此操作')
})
test('a missing call service is recognised and explained', () => {
 const error = new CallServiceUnavailableError()
 assert.equal(isCallServiceUnavailable(error), true)
 assert.equal(isCallServiceUnavailable(new Error('通话服务未启用')), false)
 assert.match(errorMessage(error, zhT), /通话服务未启用/)
})
