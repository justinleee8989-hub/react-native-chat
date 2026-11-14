import assert from 'node:assert/strict'
import test from 'node:test'
import { createCallController, encodeSignal } from './signaling.ts'
const id = 'imcall-11111111-1111-4111-8111-111111111111'
function fixture() {
 let now = 1000; const sent = []
 const c = createCallController({ now: () => now, send: async (peer, signal) => { sent.push({peer, signal}) } })
 c.reset('self')
 const receive = (from, signal) => c.receive({clientMsgID: `${from}-${signal.kind}`, sendID:from, recvID:'self', sendTime:now, contentType:101, status:2, textElem:{content:encodeSignal(signal)}})
 return {c, sent, receive, advance: () => {now=50000;c.tick()}, invite:{room:id, expires:46000, kind:'invite', name:'Peer'}}
}
test('accept requires matching authenticated peer; late end cannot resurrect call', async () => {
 const {c,receive,invite}=fixture(); await c.start('peer','Peer',id)
 receive('attacker',{...invite,kind:'accept'}); assert.equal(c.snapshot().active.phase,'outgoing')
 receive('peer',{...invite,kind:'accept'}); assert.equal(c.snapshot().active.phase,'connected')
 await c.finish('end'); receive('peer',{...invite,kind:'accept'}); assert.equal(c.snapshot().active,undefined)
})
test('incoming can reject; duplicate invitation does not ring twice', async () => {
 const {c,receive,invite,sent}=fixture(); receive('peer',invite); assert.equal(c.snapshot().active.phase,'incoming')
 await c.finish('reject'); receive('peer',invite); assert.equal(c.snapshot().active,undefined); assert.equal(sent.at(-1).signal.kind,'reject')
})
test('busy and unanswered calls produce real signals', async () => {
 const {c,receive,invite,sent,advance}=fixture(); await c.start('peer','Peer',id)
 receive('other',{...invite,room:'imcall-22222222-2222-4222-8222-222222222222'}); await new Promise(r=>setImmediate(r))
 assert.equal(sent.at(-1).signal.kind,'busy'); advance(); await new Promise(r=>setImmediate(r))
 assert.equal(c.snapshot().active,undefined); assert.equal(sent.at(-1).signal.kind,'missed')
})
test('offline expired invitation never rings; group messages ignored', () => {
 const {c,receive,invite}=fixture(); receive('peer',{...invite,expires:999}); assert.equal(c.snapshot().active,undefined)
 c.receive({clientMsgID:'g',groupID:'group',sendID:'peer',recvID:'self',contentType:101,textElem:{content:encodeSignal(invite)}})
 assert.equal(c.snapshot().active,undefined)
})
test('a group media room reserves busy state until it is released', async () => {
 const {c, receive, invite, sent}=fixture()
 c.reserveRoom('group-room')
 await assert.rejects(c.start('peer','Peer',id), /通话/)
 receive('peer',invite); await new Promise(r=>setImmediate(r))
 assert.equal(c.snapshot().active,undefined); assert.equal(sent.at(-1).signal.kind,'busy')
 c.reserveRoom('')
 await c.start('peer','Peer',id); assert.equal(c.snapshot().active.phase,'outgoing')
})
