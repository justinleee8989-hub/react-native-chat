import test from 'node:test'
import assert from 'node:assert/strict'
import { assertActiveInvitation, formatCallInvitation, parseCallInvitation } from './invitation.ts'

const room = 'imcall-123e4567-e89b-12d3-a456-426614174000'

test('parses a valid OpenIM call invitation', () => {
  const invitation = { room, expires: 2_000_000_000_000 }
  assert.deepEqual(parseCallInvitation(formatCallInvitation(invitation)), invitation)
})

test('ignores ordinary text and a different marker', () => {
  assert.equal(parseCallInvitation('hello'), undefined)
  assert.equal(parseCallInvitation('[Other invitation] {"room":"' + room + '","expires":2000000000000}'), undefined)
})

test('rejects invalid JSON, room IDs, and nonnumeric expiration', () => {
  assert.equal(parseCallInvitation('[OpenIM 通话邀请] {broken'), undefined)
  assert.equal(parseCallInvitation(formatCallInvitation({ room: 'other-room', expires: 2_000_000_000_000 })), undefined)
  assert.equal(parseCallInvitation('[OpenIM 通话邀请] ' + JSON.stringify({ room, expires: '2000000000000' })), undefined)
})

test('asserts that an invitation is active at the supplied time', () => {
  assert.doesNotThrow(() => assertActiveInvitation({ room, expires: 2_000 }, 1_999))
  assert.throws(() => assertActiveInvitation({ room, expires: 2_000 }, 2_000), /过期或无效/)
  assert.throws(() => assertActiveInvitation({ room: 'invalid', expires: 2_000 }, 1_999), /过期或无效/)
})

test('ended room cannot be retried even before invite timestamp expires', async () => {
 const { assertJoinableInvitation }=await import('./invitation.ts')
 assert.throws(()=>assertJoinableInvitation({status:'ended',expires:Date.now()+100000}),/结束/)
 assert.throws(()=>assertJoinableInvitation({status:'accepted',expires:0}),/过期/)
 assert.doesNotThrow(()=>assertJoinableInvitation({status:'accepted',expires:Date.now()+100000}))
})
