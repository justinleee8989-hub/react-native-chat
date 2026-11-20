import test from 'node:test'
import assert from 'node:assert/strict'
import { createServerCallController } from './server-controller.ts'
test('media preferences survive accept/poll but never leak into another room or account', async () => {
 let result = { room: 'r', caller: 'a', callee: 'b', status: 'ringing', created: 1, expires: 45000, members: {} }
 const c = createServerCallController({ request: async () => [result], record: async () => {} })
 c.reset('b'); await c.poll()
 c.setMediaPreference('r', 'microphone', false)
 c.setMediaPreference('r', 'camera', true)
 result = { ...result, status: 'accepted', members: { a: { lease: 50000 }, b: { lease: 50000 } } }
 await c.poll()
 assert.deepEqual(c.snapshot().active.media, { microphone: false, camera: true, speaker: true })
 c.setMediaPreference('wrong-room', 'camera', false)
 assert.equal(c.snapshot().active.media.camera, true)
 c.reset('b'); result = { ...result, room: 'new', status: 'ringing', members: {} }; await c.poll()
 assert.deepEqual(c.snapshot().active.media, { microphone: true, camera: false, speaker: true })
})
