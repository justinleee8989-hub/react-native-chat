import assert from 'node:assert/strict'
import test from 'node:test'
import { projectCallMessages, callMessageLabel } from './message-projection.ts'
import { encodeSignal } from './signaling.ts'
import { zhT } from '../i18n/test-modules.mjs'
const room = 'imcall-11111111-1111-4111-8111-111111111111'
const msg = (id, kind, extra = {}) => ({ clientMsgID: id, contentType: 101, status: 2, sendID: 'caller', recvID: 'callee', sendTime: 1000, textElem: { content: encodeSignal({ room, expires: 45000, kind }) }, ...extra })
test('terminal projection keeps its original ID, sender, time and original data untouched', () => {
 const invite = msg('invite', 'invite'), accept = msg('accept', 'accept', { sendID: 'callee', recvID: 'caller', sendTime: 2000 }), end = msg('end', 'end', { sendTime: 3000 })
 const input = [end, accept, invite]
 assert.deepEqual(projectCallMessages(input), [end])
 assert.equal(input.length, 3)
 assert.equal(projectCallMessages(input)[0], end)
})
test('never combines failed messages, group messages, other participants or expiry', () => {
 const end = msg('end', 'cancel')
 const others = [msg('failed', 'invite', { status: 3 }), msg('group', 'invite', { groupID: 'group' }), msg('stranger', 'invite', { sendID: 'stranger' }), msg('different-expiry', 'invite', { textElem: { content: encodeSignal({ room, expires: 46000, kind: 'invite' }) } })]
 assert.deepEqual(projectCallMessages([end, ...others]), [end, ...others])
})
test('missing terminal does not fabricate missed calls; revoked messages survive', () => {
 const invite = msg('invite', 'invite'), revoke = msg('revoke', 'cancel', { contentType: 2101 })
 assert.deepEqual(projectCallMessages([invite, revoke]), [invite, revoke])
})
test('out of order duplicate lifecycle records choose latest terminal but keep future invite', () => {
 const end = msg('end', 'cancel', { sendTime: 3000 }), older = msg('older', 'cancel', { sendTime: 2000 }), future = msg('future', 'invite', { sendTime: 4000 })
 assert.deepEqual(projectCallMessages([older, future, msg('invite', 'invite'), end]), [future, end])
})
test('labels distinguish local and remote reject and never invent duration', () => {
 assert.equal(callMessageLabel(msg('reject', 'reject', { sendID: 'callee' }), 'caller', zhT), '对方已拒接')
 assert.equal(callMessageLabel(msg('reject', 'reject', { sendID: 'callee' }), 'callee', zhT), '已拒接')
 assert.equal(callMessageLabel(msg('end', 'end'), 'caller', zhT), '音视频通话')
})
test('explicitly located or quoted original IDs remain visible after folding', () => {
 const invite = msg('invite', 'invite'), end = msg('end', 'cancel', { sendTime: 2000 })
 assert.deepEqual(projectCallMessages([end, invite], ['invite']), [end, invite])
})

test('server v2 result wins over a later old-client result for the same call', () => {
 const room = 'imcall-11111111-1111-4111-8111-111111111111'
 const signal = { version: 2, eventID: `rtc-terminal:${room}`, room, caller: 'a', callee: 'b', status: 'ended', kind: 'end', expires: 45000, connectedAt: 50000, ended: 100000, durationSeconds: 50 }
 const server = { clientMsgID: 'server', contentType: 101, status: 2, sendID: 'a', recvID: 'b', sendTime: 100000, textElem: { content: '[OpenIM 呼叫] '+JSON.stringify(signal) } }
 const old = { ...server, clientMsgID: 'old', sendID: 'b', recvID: 'a', sendTime: 101000, textElem: {content: '[OpenIM 呼叫] '+JSON.stringify({room, expires:45000,kind:'end'})} }
 assert.deepEqual(projectCallMessages([old, server]).map(m => m.clientMsgID), ['server'])
})

test('an ending the server answered shows on the invitation until its record arrives', () => {
 const outcome = { version: 2, eventID: `rtc-terminal:${room}`, room, caller: 'caller', callee: 'callee', status: 'canceled', kind: 'cancel', expires: 45000, ended: 2000 }
 const invite = msg('invite', 'invite')
 const shown = projectCallMessages([invite], [], { [room]: outcome })
 assert.deepEqual(shown.map(m => m.clientMsgID), ['invite'])
 assert.equal(callMessageLabel(shown[0], 'caller', zhT), callMessageLabel({ ...invite, textElem: { content: encodeSignal({ room, expires: 45000, kind: 'cancel' }) } }, 'caller', zhT))
 assert.equal(invite.textElem.content, encodeSignal({ room, expires: 45000, kind: 'invite' }))
 const record = { ...invite, clientMsgID: 'server', sendTime: 3000, textElem: { content: encodeSignal({ ...outcome, kind: 'end', status: 'ended' }) } }
 assert.deepEqual(projectCallMessages([record, invite], [], { [room]: outcome }), [record])
 assert.deepEqual(projectCallMessages([invite], [], { [room]: { ...outcome, caller: 'stranger' } }), [invite])
})
