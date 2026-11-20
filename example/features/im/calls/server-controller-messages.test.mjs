import assert from 'node:assert/strict'
import test from 'node:test'
import { createServerCallController } from './server-controller.ts'
import { encodeSignal } from './signaling.ts'

// A one-to-one call's messages move it on at once; the server is asked only as a fallback.
const room = 'imcall-22222222-2222-4222-8222-222222222222'
const expires = 46000
const ringing = { room, caller: 'peer', callee: 'me', status: 'ringing', created: 1000, expires, members: {} }
const text = (sendID, recvID, signal) => ({ sendID, recvID, contentType: 101, senderNickname: 'Peer', textElem: { content: encodeSignal(signal) } })
const record = (status, kind, caller = 'peer', callee = 'me') => ({ version: 2, eventID: `rtc-terminal:${room}`, room, caller, callee, status, kind, expires, ended: 5000 })
const settle = () => new Promise(resolve => setImmediate(resolve))
function controller (answer = () => [ringing], clock = { now: 1000 }) {
  const actions = []
  const c = createServerCallController({ request: async req => {
    actions.push(req.action); return answer(req)
  }, record: async () => {}, now: () => clock.now })
  c.reset('me')
  return { c, actions, clock }
}

test('an invitation from the other side rings at once and is checked with this one call, not a list', async () => {
  const { c, actions, clock } = controller()
  c.receive(text('peer', 'me', { room, expires, kind: 'invite' }))
  assert.equal(c.snapshot().active?.phase, 'incoming')
  assert.equal(c.snapshot().active?.peer, 'peer')
  await settle()
  assert.deepEqual(actions, ['get'])
  clock.now += 5000; c.tick(); await settle()
  assert.deepEqual(actions, ['get'])
  clock.now += 6000; c.tick(); await settle()
  assert.deepEqual(actions, ['get', 'get'])
})

test('no invitation rings that is this user\'s own, expired, for someone else, or for a call already over here', async () => {
  const { c } = controller()
  c.receive(text('me', 'peer', { room, expires, kind: 'invite' }))
  c.receive(text('peer', 'me', { room, expires: 1000, kind: 'invite' }))
  c.receive(text('peer', 'other', { room, expires, kind: 'invite' }))
  c.receive({ ...text('peer', 'me', { room, expires, kind: 'invite' }), groupID: 'group' })
  assert.equal(c.snapshot().active, undefined)
})

test('the other side answering connects the caller at once', async () => {
  const outgoing = { ...ringing, caller: 'me', callee: 'peer' }
  const { c } = controller(() => [outgoing])
  await c.start('peer', 'Peer', 'id')
  c.receive(text('other', 'me', { room, expires, kind: 'accept' }))
  c.receive(text('peer', 'me', { room, expires: expires + 1, kind: 'accept' }))
  assert.equal(c.snapshot().active?.phase, 'outgoing')
  c.receive(text('peer', 'me', { room, expires, kind: 'accept' }))
  assert.equal(c.snapshot().active?.phase, 'connected')
})

test('answered on another of this user\'s devices, this one stops ringing without a word', async () => {
  const { c, actions } = controller()
  c.receive(text('peer', 'me', { room, expires, kind: 'invite' }))
  c.receive(text('me', 'peer', { room, expires, kind: 'accept' }))
  assert.equal(c.snapshot().active, undefined)
  assert.equal(c.snapshot().notice, '')
  c.receive(text('peer', 'me', { room, expires, kind: 'invite' }))
  assert.equal(c.snapshot().active, undefined)
  assert.deepEqual(actions, ['get'])
})

test('the record of how the call ended ends it here at once, and with the server too', async () => {
  const { c, actions } = controller(req => req.action === 'reject' ? [{ ...ringing, status: 'canceled', ended: 5000, serverRecordDelivery: true }] : [ringing])
  c.receive(text('peer', 'me', { room, expires, kind: 'invite' }))
  c.receive(text('peer', 'me', record('canceled', 'cancel')))
  assert.equal(c.snapshot().active, undefined)
  assert.equal(c.snapshot().notice, 'call.canceled')
  await settle()
  assert.deepEqual(actions, ['get', 'reject'])
  assert.equal(c.snapshot().outcomes[room]?.kind, 'cancel')
})

test('the caller\'s own copy of the record, sent as them by the server, ends the call on their side', async () => {
  const outgoing = { ...ringing, caller: 'me', callee: 'peer' }
  const { c } = controller(req => req.action === 'cancel' ? [{ ...outgoing, status: 'missed', ended: 5000, serverRecordDelivery: true }] : [outgoing])
  await c.start('peer', 'Peer', 'id')
  c.receive(text('me', 'peer', record('missed', 'missed', 'me', 'peer')))
  assert.equal(c.snapshot().active, undefined)
  assert.equal(c.snapshot().notice, 'call.missed')
})

test('a record not sent as its caller, or for another call, changes nothing', async () => {
  const { c, actions } = controller()
  c.receive(text('peer', 'me', { room, expires, kind: 'invite' }))
  // From the callee, who the server never sends it as.
  c.receive(text('me', 'peer', record('ended', 'end')))
  c.receive(text('peer', 'me', { ...record('ended', 'end'), expires: expires + 1 }))
  c.receive(text('peer', 'me', { room, expires, kind: 'end' }))
  assert.equal(c.snapshot().active?.phase, 'incoming')
  assert.deepEqual(actions, ['get'])
})

test('with no call on, calls are listed once a sign-in, a return to the app or a reconnect asks, never every few seconds', async () => {
  const { c, actions, clock } = controller(() => [])
  for (let i = 0; i < 10; i++) {
    clock.now += 11000; c.tick(); await settle()
  }
  assert.deepEqual(actions, ['list'])
  c.recheck()
  c.tick(); await settle()
  assert.deepEqual(actions, ['list', 'list'])
})

test('a call dialed or answered on another of this user\'s devices is left to that device', async () => {
  const listed = { calls: [] }
  const { c } = controller(() => listed.calls)
  // Answered elsewhere, from either side: not joined here, which would push that device out.
  for (const call of [{ ...ringing, status: 'accepted' }, { ...ringing, caller: 'me', callee: 'peer', status: 'accepted' }]) {
    listed.calls = [call]; c.recheck(); await c.poll()
    assert.equal(c.snapshot().active, undefined)
  }
  // Dialed elsewhere: not shown here as this device calling.
  listed.calls = [{ ...ringing, caller: 'me', callee: 'peer' }]; await c.poll()
  assert.equal(c.snapshot().active, undefined)
  // Ringing for this user: rings on every one of their devices, any of which can answer it.
  listed.calls = [ringing]; await c.poll()
  assert.equal(c.snapshot().active?.phase, 'incoming')
})

test('the call on this device is still followed by the list, and a group call still is too', async () => {
  const outgoing = { ...ringing, caller: 'me', callee: 'peer' }
  const answer = { calls: [outgoing] }
  const { c } = controller(() => answer.calls)
  await c.start('peer', 'Peer', 'id')
  answer.calls = [{ ...outgoing, status: 'accepted' }]; await c.poll()
  assert.equal(c.snapshot().active?.phase, 'connected')
  const group = { ...ringing, room: 'imcall-group', caller: 'peer', callee: undefined, groupID: 'group', status: 'accepted', members: { me: { lease: 90000 } } }
  const other = controller(() => [group]).c
  await other.poll()
  assert.equal(other.snapshot().active?.room, 'imcall-group')
})
