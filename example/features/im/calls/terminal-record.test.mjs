import test from 'node:test'
import assert from 'node:assert/strict'
import { parseSignal } from './signaling.ts'
import { createServerCallController } from './server-controller.ts'
const payload = { version: 2, eventID: 'rtc-terminal:imcall-11111111-1111-4111-8111-111111111111', room: 'imcall-11111111-1111-4111-8111-111111111111', caller: 'a', callee: 'b', status: 'ended', kind: 'end', expires: 45000, ended: 100000, connectedAt: 50000, durationSeconds: 50 }
test('retains validated terminal metadata and rejects invalid duration', () => {
 assert.equal(parseSignal('[OpenIM 呼叫] '+JSON.stringify(payload)).durationSeconds, 50)
 assert.equal(parseSignal('[OpenIM 呼叫] '+JSON.stringify({...payload, durationSeconds: -1})), undefined)
})
test('does not send duplicate client records when authority owns delivery', async () => {
 const sent = []
 let response = { room: payload.room, caller: 'a', callee: 'b', status: 'ringing', created: 1, expires: 45000, members: {}, serverRecordDelivery: true }
 const c = createServerCallController({ request: async () => [response], record: async (...args) => sent.push(args) })
 c.reset('a'); await c.poll(); response = {...response,status:'canceled'}
 await c.finish()
 assert.equal(sent.length, 0)
})
