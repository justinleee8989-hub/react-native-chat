import assert from 'node:assert/strict'
import test from 'node:test'
import { createCallController, encodeSignal, parseSignal } from './signaling.ts'
import { zhT } from '../i18n/test-modules.mjs'
import { errorMessage } from '../shared/error-message.ts'

const room = 'imcall-33333333-3333-4333-8333-333333333333'
const otherRoom = 'imcall-44444444-4444-4444-8444-444444444444'
const invitation = { room, expires: 46_000, kind: 'invite', name: 'Peer' }

function deferred() {
  let resolve
  let reject
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

function fixture(send = async () => {}) {
  let now = 1_000
  const sent = []
  const controller = createCallController({
    now: () => now,
    send: async (peer, signal) => {
      sent.push({ peer, signal })
      return send(peer, signal)
    },
  })
  controller.reset('self')
  const receive = (sender, signal, overrides = {}) => controller.receive({
    clientMsgID: `${sender}-${signal.kind}-${signal.expires}`,
    sendID: sender,
    recvID: 'self',
    sendTime: now,
    contentType: 101,
    status: 2,
    textElem: { content: encodeSignal(signal) },
    ...overrides,
  })
  return { controller, receive, sent, setNow: value => { now = value } }
}

test('local cancellation and remote rejection end only the matching outgoing call', async () => {
  const local = fixture()
  await local.controller.start('peer', 'Peer', room)
  await local.controller.finish('cancel')
  assert.equal(local.sent.at(-1).signal.kind, 'cancel')
  assert.equal(local.controller.snapshot().active, undefined)
  assert.equal(zhT(local.controller.snapshot().notice), '通话已取消')

  const remote = fixture()
  await remote.controller.start('peer', 'Peer', room)
  remote.receive('peer', { ...invitation, kind: 'reject' })
  assert.equal(remote.controller.snapshot().active, undefined)
  assert.equal(zhT(remote.controller.snapshot().notice), '已拒接通话')
})

test('a matching busy response ends the call; a busy peer sends busy for a different incoming room', async () => {
  const response = fixture()
  await response.controller.start('peer', 'Peer', room)
  response.receive('peer', { ...invitation, kind: 'busy' })
  assert.equal(response.controller.snapshot().active, undefined)
  assert.equal(zhT(response.controller.snapshot().notice), '对方正在通话')

  const overlapping = fixture()
  await overlapping.controller.start('peer', 'Peer', room)
  overlapping.receive('other', { ...invitation, room: otherRoom })
  assert.equal(overlapping.controller.snapshot().active.room, room)
  assert.equal(overlapping.sent.at(-1).peer, 'other')
  assert.equal(overlapping.sent.at(-1).signal.kind, 'busy')
})

test('an incoming call times out and reports missed', () => {
  const { controller, receive, sent, setNow } = fixture()
  receive('peer', invitation)
  setNow(invitation.expires)
  controller.tick()
  assert.equal(controller.snapshot().active, undefined)
  assert.equal(zhT(controller.snapshot().notice), '未接通话')
  assert.equal(sent.at(-1).signal.kind, 'missed')
})

test('forged sender, recipient, self echo, group, and non-signal messages cannot change an active call', async () => {
  const { controller, receive } = fixture()
  await controller.start('peer', 'Peer', room)
  const before = controller.snapshot().active

  receive('attacker', { ...invitation, kind: 'reject' })
  receive('peer', { ...invitation, kind: 'reject' }, { recvID: 'someone-else' })
  receive('self', { ...invitation, kind: 'reject' })
  receive('peer', { ...invitation, kind: 'reject' }, { groupID: 'group' })
  receive('peer', { ...invitation, kind: 'reject' }, { contentType: 1 })

  assert.equal(controller.snapshot().active, before)
})

test('a terminal signal arriving before its invitation cannot resurrect the call', () => {
  const { controller, receive } = fixture()
  receive('peer', { ...invitation, kind: 'cancel' })
  receive('peer', invitation)
  assert.equal(controller.snapshot().active, undefined)
})

test('a stale signal for another room or expiry cannot replace or end the current call', async () => {
  const { controller, receive } = fixture()
  await controller.start('peer', 'Peer', room)
  const before = controller.snapshot().active

  receive('peer', { ...invitation, room: otherRoom, kind: 'reject' })
  receive('peer', { ...invitation, expires: invitation.expires + 1, kind: 'cancel' })
  assert.equal(controller.snapshot().active, before)

  receive('peer', { ...invitation, kind: 'accept' })
  receive('peer', { ...invitation, kind: 'end' })
  assert.equal(controller.snapshot().active, undefined)
})

test('send failures clear outgoing calls and failed accepts restore the incoming call', async () => {
  const failedStart = fixture(async () => { throw new Error('send unavailable') })
  await assert.rejects(failedStart.controller.start('peer', 'Peer', room), /send unavailable/)
  assert.equal(failedStart.controller.snapshot().active, undefined)
  assert.equal(failedStart.controller.snapshot().error.message, 'send unavailable')

  let rejectAccept
  const failedAccept = fixture((peer, signal) => signal.kind === 'accept'
    ? new Promise((_, reject) => { rejectAccept = reject })
    : Promise.resolve())
  failedAccept.receive('peer', invitation)
  const accepting = failedAccept.controller.accept()
  assert.equal(failedAccept.controller.snapshot().active.phase, 'accepting')
  rejectAccept(new Error('accept unavailable'))
  await accepting
  assert.equal(failedAccept.controller.snapshot().active.phase, 'incoming')
  assert.equal(failedAccept.controller.snapshot().error.message, 'accept unavailable')
})

test('late send completion after logout cannot restore the previous account call state', async () => {
  const request = deferred()
  const { controller, receive } = fixture(() => request.promise)
  const starting = controller.start('peer', 'Peer', room)
  controller.reset('next-user')
  request.resolve()
  await starting

  assert.deepEqual(controller.snapshot(), { error: '', notice: '', active: undefined })
  receive('peer', invitation, { recvID: 'self' })
  assert.equal(controller.snapshot().active, undefined)
})

test('signal parsing enforces exact marker, safe expiry, allowed kinds, valid rooms, and bounded names', () => {
  assert.equal(parseSignal('ordinary text'), undefined)
  assert.equal(parseSignal(encodeSignal({ ...invitation, expires: Number.MAX_SAFE_INTEGER + 1 })), undefined)
  assert.equal(parseSignal(encodeSignal({ ...invitation, kind: '__proto__' })), undefined)
  assert.equal(parseSignal(encodeSignal({ ...invitation, room: 'imcall-not-a-uuid' })), undefined)

  const parsed = parseSignal(encodeSignal({ ...invitation, name: 'x'.repeat(100) }))
  assert.equal(parsed.name.length, 80)
})
