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
 await c.finish('end')
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

test('records the server terminal outcome instead of the requested finish label', async () => {
 const recorded = []
 const c = createServerCallController({ request: async req => [req.action === 'cancel' ? { ...call, status: 'canceled' } : call], record: async (_peer, signal) => recorded.push(signal.kind), now: () => 1000 })
 c.reset('me'); await c.start('peer', 'Peer', 'id'); await c.finish('end')
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
 clock += 3000; c.tick(); await new Promise(r => setImmediate(r))
 clock += 3000; c.tick(); await new Promise(r => setImmediate(r))
 assert.equal(polls, 1)
 c.serviceAnswered()
 clock += 3000; c.tick(); await new Promise(r => setImmediate(r))
 assert.equal(polls, 2)
})
