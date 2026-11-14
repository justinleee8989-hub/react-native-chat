import assert from 'node:assert/strict'
import test from 'node:test'
import { createServerCallController } from './server-controller.ts'
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
 await c.poll();assert.equal(c.snapshot().active,undefined);assert.match(c.snapshot().notice,/连接中断/)
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

test('call record failure preserves a safe SDK explanation', async () => {
 const c = createServerCallController({
  request: async () => [call],
  record: async () => { throw new Error('message rejected by policy') },
  now: () => 1000,
 })
 c.reset('me')
 await c.start('peer', 'Peer', 'id')
 assert.match(c.snapshot().error, /message rejected by policy/)
})

test('call controller can surface group invitation failure after navigation', () => {
 const c = createServerCallController({ request: async () => [], record: async () => {} })
 c.reset('me')
 c.notifyError('群通话邀请未送达：消息被拒绝')
 assert.equal(c.snapshot().error, '群通话邀请未送达：消息被拒绝')
})
