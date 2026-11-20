import assert from 'node:assert/strict'
import test from 'node:test'
import { CallServiceUnavailableError } from './errors.ts'
import { createServerCallController } from './server-controller.ts'
import { zhT } from '../i18n/test-modules.mjs'
import { errorMessage } from '../shared/error-message.ts'
const call={room:'imcall-test',caller:'me',callee:'peer',status:'ringing',created:1000,expires:46000,members:{}}
test('untrusted IM text cannot accept server-owned calls',async()=>{
 const c=createServerCallController({request:async()=>[call],record:async()=>{},now:()=>1000})
 c.reset('me');await c.start('peer','Peer','id')
 c.receive({textElem:{content:'anything'}})
 assert.equal(c.snapshot().active.phase,'outgoing')
})
test('server terminal state removes active media and surfaces result',async()=>{
 let data=call;const c=createServerCallController({request:async()=>[data],record:async()=>{},now:()=>1000})
 c.reset('me');await c.start('peer','Peer','id');data={...call,status:'disconnected',ended:2000}
 await c.poll();assert.equal(c.snapshot().active,undefined);assert.match(zhT(c.snapshot().notice),/连接中断/)
})
test('late request from prior login cannot restore call',async()=>{
 let resolve;const c=createServerCallController({request:()=>new Promise(r=>resolve=r),record:async()=>{}})
 c.reset('me');const pending=c.start('peer','Peer','id');c.reset('new');resolve([call]);await pending
 assert.equal(c.snapshot().active,undefined)
})

test('joining a group call again clears its previous local ignore state', async () => {
 let accepted = { ...call, room: 'imcall-group', groupID: 'group', status: 'accepted', members: { me: { lease: 90000 } } }
 const c = createServerCallController({
  request: async req => {
   if (req.action === 'create') return [accepted]
   if (req.action === 'leave') return [{ ...accepted, members: {} }]
   if (req.action === 'join') return [accepted]
   return [accepted]
  }, record: async () => {}, now: () => 1000,
 })
 c.reset('me')
 await c.group('group', 'request')
 await c.finish()
 await c.join(accepted.room)
 assert.equal(c.snapshot().active?.room, accepted.room)
 assert.equal(c.snapshot().active?.phase, 'connected')
})

test('concurrent group join attempts issue only one authority request', async () => {
 let resolve; let joins = 0
 const accepted = { ...call, room: 'imcall-group', groupID: 'group', status: 'accepted', members: { me: { lease: 90000 } } }
 const c = createServerCallController({ request: async req => {
  if (req.action === 'join') { joins++; return new Promise(r => { resolve = () => r([accepted]) }) }
  return [accepted]
 }, record: async () => {}, now: () => 1000 })
 c.reset('me')
 const first = c.join(accepted.room)
 await c.join(accepted.room)
 assert.equal(joins, 1)
 resolve(); await first
})

test('a call record failure says the call is saved, without the SDK wording', async () => {
 const c = createServerCallController({
  request: async () => [call],
  record: async () => { throw new Error('message rejected by policy') },
  now: () => 1000,
 })
 c.reset('me')
 await c.start('peer', 'Peer', 'id')
 assert.match(errorMessage(c.snapshot().error, zhT), /通话状态已保存/)
 assert.doesNotMatch(errorMessage(c.snapshot().error, zhT), /policy/)
})

test('call controller can surface group invitation failure after navigation', () => {
 const c = createServerCallController({ request: async () => [], record: async () => {} })
 c.reset('me')
 const failure = new Error('群通话邀请未送达')
 c.notifyError(failure)
 assert.equal(c.snapshot().error, failure)
})

test('records the server terminal outcome, not one guessed here', async () => {
 const recorded = []
 const c = createServerCallController({ request: async req => [req.action === 'cancel' ? { ...call, status: 'canceled' } : call], record: async (_peer, signal) => recorded.push(signal.kind), now: () => 1000 })
 c.reset('me'); await c.start('peer', 'Peer', 'id'); await c.finish()
 assert.deepEqual(recorded, ['invite', 'cancel'])
})

test('polling stops while the server has no call service and resumes after it answers again', async () => {
 let clock = 1000; let polls = 0; let enabled = false
 const c = createServerCallController({ request: async () => {
  polls++
  if (!enabled) throw new CallServiceUnavailableError()
  return []
 }, record: async () => {}, now: () => clock })
 c.reset('me')
 for (let i = 0; i < 10; i++) { clock += 3000; c.tick(); await new Promise(r => setImmediate(r)) }
 assert.equal(polls, 1)
 enabled = true
 await c.start('peer', 'Peer', 'id')
 clock += 3000; c.tick(); await new Promise(r => setImmediate(r))
 assert.equal(polls, 3)
})

test('an answer to the 通话 page resumes polling stopped for a missing call service', async () => {
 let clock = 1000; let polls = 0
 const c = createServerCallController({ request: async () => {
  polls++
  throw new CallServiceUnavailableError()
 }, record: async () => {}, now: () => clock })
 c.reset('me')
 clock += 11000; c.tick(); await new Promise(r => setImmediate(r))
 clock += 11000; c.tick(); await new Promise(r => setImmediate(r))
 assert.equal(polls, 1)
 c.serviceAnswered()
 clock += 11000; c.tick(); await new Promise(r => setImmediate(r))
 assert.equal(polls, 2)
})
test('a call answered and ended between two polls says it never connected, not that it took place', async () => {
 let data = call
 const c = createServerCallController({ request: async () => [data], record: async () => {}, now: () => 1000 })
 c.reset('me'); await c.start('peer', 'Peer', 'id')
 assert.equal(c.snapshot().active.phase, 'outgoing')
 data = { ...call, status: 'ended', connectedAt: 1500, ended: 2000 }
 await c.poll()
 assert.equal(c.snapshot().active, undefined)
 assert.equal(zhT(c.snapshot().notice), '通话未能接通，已结束')
})
test('a new call found by polling clears the last call\'s notice, so the same ending is said again', async () => {
 let data = call
 const c = createServerCallController({ request: async () => [data], record: async () => {}, now: () => 1000 })
 c.reset('me'); await c.start('peer', 'Peer', 'id')
 data = { ...call, status: 'ended', connectedAt: 1500, ended: 2000 }
 await c.poll()
 assert.equal(c.snapshot().notice, 'call.endedBeforeConnect')
 data = { ...call, room: 'imcall-next', caller: 'peer', callee: 'me' }
 await c.poll()
 assert.equal(c.snapshot().active.phase, 'incoming')
 assert.equal(c.snapshot().notice, '')
})
test('a call that ends in the same answer as a new one rings keeps its notice', async () => {
 let data = [call]
 const c = createServerCallController({ request: async () => data, record: async () => {}, now: () => 1000 })
 c.reset('me'); await c.start('peer', 'Peer', 'id')
 data = [{ ...call, status: 'rejected', ended: 2000 }, { ...call, room: 'imcall-next', caller: 'peer', callee: 'me' }]
 await c.poll()
 assert.equal(c.snapshot().active.room, 'imcall-next')
 assert.equal(c.snapshot().notice, 'call.rejected')
})
test('a call seen answered that then ends keeps the plain ended notice', async () => {
 let data = call
 const c = createServerCallController({ request: async () => [data], record: async () => {}, now: () => 1000 })
 c.reset('me'); await c.start('peer', 'Peer', 'id')
 data = { ...call, status: 'accepted', connectedAt: 1500 }
 await c.poll()
 data = { ...call, status: 'ended', connectedAt: 1500, ended: 9000 }
 await c.poll()
 assert.equal(c.snapshot().notice, 'call.ended')
})

test('waiting for a group call to connect here ends with the media, or with the call', async () => {
 const accepted = { ...call, room: 'imcall-group', groupID: 'group', status: 'accepted', members: { me: { lease: 90000 } } }
 const c = createServerCallController({ request: async req => req.action === 'leave' ? [{ ...accepted, members: {} }] : [accepted], record: async () => {}, now: () => 1000 })
 c.reset('me')
 await c.group('group', 'request')
 const connected = c.whenMediaReady(accepted.room)
 c.mediaReady(accepted.room, true)
 assert.equal(await connected, true)

 c.mediaReady(accepted.room, false)
 const failed = c.whenMediaReady(accepted.room)
 await c.finish()
 assert.equal(await failed, false)
 assert.equal(await c.whenMediaReady(accepted.room), false)
})

test('a hang-up the server does not answer is not said: the call has already ended here', async () => {
 const c = createServerCallController({ request: async req => {
  if (req.action === 'cancel') throw new Error('aborted')
  return [call]
 }, record: async () => {}, now: () => 1000 })
 c.reset('me'); await c.start('peer', 'Peer', 'id')
 await assert.rejects(c.finish())
 assert.equal(c.snapshot().active, undefined)
 assert.equal(c.snapshot().error, '')
})

const room = 'imcall-11111111-1111-4111-8111-111111111111'
test('a hang-up the server records keeps its outcome for the chat at once, until the next sign-in', async () => {
 const ringing = { ...call, room }
 const c = createServerCallController({ request: async req => req.action === 'cancel' ? [{ ...ringing, status: 'canceled', ended: 3000, serverRecordDelivery: true }] : [ringing], record: async () => assert.fail('the server records it'), now: () => 1000 })
 c.reset('me'); await c.start('peer', 'Peer', 'id'); await c.finish()
 assert.deepEqual(c.snapshot().outcomes[room], { version: 2, eventID: `rtc-terminal:${room}`, room, caller: 'me', callee: 'peer', status: 'canceled', kind: 'cancel', expires: 46000, ended: 3000, connectedAt: undefined, durationSeconds: undefined })
 c.reset('me')
 assert.deepEqual(c.snapshot().outcomes, {})
})
test('the other side ending the call is kept as its outcome when polling sees it', async () => {
 let data = { ...call, room }
 const c = createServerCallController({ request: async () => [data], record: async () => {}, now: () => 1000 })
 c.reset('me'); await c.start('peer', 'Peer', 'id')
 data = { ...data, status: 'rejected', ended: 2000, serverRecordDelivery: true }
 await c.poll()
 assert.equal(c.snapshot().outcomes[room]?.kind, 'reject')
})
test('no outcome for a call the server does not record, or a group call', async () => {
 const ringing = { ...call, room }
 const c = createServerCallController({ request: async req => req.action === 'cancel' ? [{ ...ringing, status: 'canceled', ended: 3000 }] : [ringing], record: async () => {}, now: () => 1000 })
 c.reset('me'); await c.start('peer', 'Peer', 'id'); await c.finish()
 assert.deepEqual(c.snapshot().outcomes, {})
})

const connectedCall = { ...call, status: 'accepted', members: { me: { lease: 90000 }, peer: { lease: 90000 } } }
const flush = () => new Promise(r => setImmediate(r))
test('the other side joining asks for the connect time at once, then backs off three times at most', async () => {
 let clock = 1000; const actions = []
 const c = createServerCallController({ request: async req => {
  actions.push(req.action); return [connectedCall]
 }, record: async () => {}, now: () => clock })
 c.reset('me'); await c.start('peer', 'Peer', 'id'); c.mediaReady(call.room, true)
 actions.length = 0
 c.peerJoined(call.room); await flush()
 assert.deepEqual(actions, ['heartbeat'])
 // Asked again after 1, 2 and 4 seconds, then only the heartbeat's own pace.
 for (const wait of [500, 500, 2000, 4000, 1000, 1000, 1000]) {
  clock += wait; c.tick(); await flush()
 }
 assert.equal(actions.length, 4)
 clock += 8000; c.tick(); await flush()
 assert.equal(actions.length, 5)
 // Once per call: the other side coming back does not start it over.
 c.peerJoined(call.room); c.tick(); await flush()
 assert.equal(actions.length, 5)
})
test('the connect time arriving stops the asking', async () => {
 let clock = 1000; let data = connectedCall; let asked = 0
 const c = createServerCallController({ request: async req => {
  if (req.action === 'heartbeat') asked++
  return [data]
 }, record: async () => {}, now: () => clock })
 c.reset('me'); await c.start('peer', 'Peer', 'id'); c.mediaReady(call.room, true)
 data = { ...connectedCall, connectedAt: 1500 }
 c.peerJoined(call.room); await flush()
 assert.equal(c.snapshot().active.connectedAt, 1500)
 clock += 1500; c.tick(); await flush()
 clock += 2500; c.tick(); await flush()
 assert.equal(asked, 1)
})
test('a call that ends stops the asking for its connect time', async () => {
 let clock = 1000; let asked = 0
 const c = createServerCallController({ request: async req => {
  if (req.action === 'heartbeat') asked++
  return req.action === 'end' ? [{ ...connectedCall, status: 'ended', ended: 1200 }] : [connectedCall]
 }, record: async () => {}, now: () => clock })
 c.reset('me'); await c.start('peer', 'Peer', 'id'); c.mediaReady(call.room, true)
 c.peerJoined(call.room); await flush()
 await c.finish()
 clock += 1500; c.tick(); await flush()
 assert.equal(asked, 1)
 assert.equal(c.snapshot().active, undefined)
})
