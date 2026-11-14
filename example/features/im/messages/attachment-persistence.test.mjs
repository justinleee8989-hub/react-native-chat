import test from 'node:test'
import assert from 'node:assert/strict'
import { createAttachmentBatchManager } from './attachment-batch.ts'

test('durable batch resumes explicitly with stable ID after an ambiguous send and isolates accounts', async () => {
  const records = new Map()
  let account = 'server/account'
  let epoch = 1
  let sends = 0
  const persistence = {
    retain: async (_scope, id, media) => ({ ...media, uri: `durable:${id}` }),
    save: async (scope, batch) => records.set(`${scope}/${batch.id}`, structuredClone(batch)),
    load: async scope => [...records].filter(([key]) => key.startsWith(`${scope}/`)).map(([, value]) => structuredClone(value)),
    remove: async () => {},
  }
  const deps = { persistence, getScope: () => account, getEpoch: () => epoch,
    createMedia: async () => ({ clientMsgID: 'stable', contentType: 105 }),
    createText: async () => ({}), send: async (_id, message) => { sends++; assert.equal(message.clientMsgID, 'stable'); if (sends === 1) throw Error('network') },
  }
  const manager = createAttachmentBatchManager(deps)
  const batch = await manager.enqueue('chat', [{ type: 'file', uri: 'blob:temporary' }])
  await assert.rejects(manager.run(batch.id), /network/)
  const recovered = createAttachmentBatchManager(deps)
  await recovered.restore()
  assert.equal(sends, 1)
  assert.equal(recovered.list()[0].status, 'failed')
  await recovered.run(batch.id)
  assert.equal(sends, 2)
  account = 'server/other'; epoch++
  recovered.reset()
  await recovered.restore()
  assert.equal(recovered.list().length, 0)
})

test('failed durable acceptance does not publish or send the task', async () => {
  const manager = createAttachmentBatchManager({ getEpoch: () => 1, getScope: () => 'account', createMedia: async () => ({}), createText: async () => ({}), send: async () => assert.fail('sent'), persistence: { retain: async () => { throw Error('quota') }, remove: async () => {}, save: async () => {}, load: async () => [] } })
  await assert.rejects(manager.enqueue('chat', [{ type: 'file', uri: 'x' }]), /quota/)
  assert.equal(manager.list().length, 0)
})

test('checkpoint storage failure prevents network send until persistence succeeds', async () => {
  let saves = 0
  let sends = 0
  const manager = createAttachmentBatchManager({ getEpoch: () => 1, getScope: () => 'scope',
    createMedia: async () => ({ clientMsgID: 'same' }), createText: async () => ({}), send: async () => { sends++ },
    persistence: { retain: async (_scope, _id, media) => media, load: async () => [], remove: async () => {}, save: async () => { saves++; if (saves === 2) throw Error('quota') } },
  })
  const batch = await manager.enqueue('chat', [{ type: 'file', uri: 'x' }])
  await assert.rejects(manager.run(batch.id), /quota/)
  assert.equal(sends, 0)
  await manager.run(batch.id)
  assert.equal(sends, 1)
})

test('logout after preparation retains old account task without sending it', async () => {
  let epoch = 1
  let record
  const deps = { getEpoch: () => epoch, getScope: () => 'scope',
    createMedia: async () => { epoch++; return { clientMsgID: 'original-id' } },
    createText: async () => ({}), send: async () => assert.fail('must not send after logout'),
    persistence: { retain: async (_scope, _id, media) => media, load: async () => record ? [structuredClone(record)] : [], remove: async () => {}, save: async (_scope, value) => { record = structuredClone(value) } },
  }
  const manager = createAttachmentBatchManager(deps)
  const batch = await manager.enqueue('chat', [{ type: 'file', uri: 'durable:file' }])
  await assert.rejects(manager.run(batch.id), /登录已改变/)
  assert.equal(record.items[0].prepared.clientMsgID, 'original-id')
  assert.equal(record.items[0].media.uri, 'durable:file')
  manager.reset()
  await manager.restore()
  assert.equal(manager.list()[0].status, 'failed')
})

test('a post-send checkpoint failure retries storage without sending delivered media again', async () => {
  let saves = 0
  let sends = 0
  const manager = createAttachmentBatchManager({ getEpoch: () => 1, getScope: () => 'scope', createMedia: async () => ({ clientMsgID: 'id' }), createText: async () => ({}), send: async () => { sends++ }, persistence: { retain: async (_scope, _id, media) => media, load: async () => [], remove: async () => {}, save: async () => { if (++saves === 4) throw Error('quota after delivery') } } })
  const batch = await manager.enqueue('chat', [{ type: 'file', uri: 'x' }])
  await assert.rejects(manager.run(batch.id), /quota after delivery/)
  assert.equal(manager.get(batch.id).items[0].status, 'sent')
  await manager.run(batch.id)
  assert.equal(sends, 1)
})

test('ambiguous delivery retry reconciles server history and never resends a delivered ID', async () => {
  let sends = 0
  let reconciles = 0
  const manager = createAttachmentBatchManager({ getEpoch: () => 1,
    createMedia: async () => ({ clientMsgID: 'delivered-id' }), createText: async () => ({}),
    send: async () => { sends++; throw Error('connection closed after delivery') },
    reconcile: async (conversationID, message) => { reconciles++; assert.equal(conversationID, 'chat'); assert.equal(message.clientMsgID, 'delivered-id'); return true },
  })
  const batch = manager.create('chat', [{ type: 'file', uri: 'x' }])
  await assert.rejects(manager.run(batch.id), /connection closed/)
  await manager.run(batch.id)
  assert.equal(sends, 1)
  assert.equal(reconciles, 1)
  assert.equal(manager.get(batch.id).status, 'completed')
})

test('history reconciliation failure blocks resend until a successful history check', async () => {
  let sends = 0
  let checks = 0
  const manager = createAttachmentBatchManager({ getEpoch: () => 1,
    createMedia: async () => ({ clientMsgID: 'unknown-id' }), createText: async () => ({}),
    send: async () => { sends++; if (sends === 1) throw Error('ambiguous') },
    reconcile: async () => { if (++checks === 1) throw Error('history unavailable'); return false },
  })
  const batch = manager.create('chat', [{ type: 'file', uri: 'x' }])
  await assert.rejects(manager.run(batch.id), /ambiguous/)
  await assert.rejects(manager.run(batch.id), /history unavailable/)
  assert.equal(sends, 1)
  assert.equal(manager.get(batch.id).items[0].prepared.clientMsgID, 'unknown-id')
  await manager.run(batch.id)
  assert.equal(sends, 2)
  assert.equal(checks, 2)
})

test('restored sending caption is reconciled before any preparation or resend', async () => {
  let checks = 0
  const saved = { id: 'caption-task', conversationID: 'chat', epoch: 0, scope: 'scope', status: 'sending', cancelled: false,
    items: [{ kind: 'caption', status: 'sending', text: 'caption', prepared: { clientMsgID: 'caption-delivered' } }] }
  const manager = createAttachmentBatchManager({ getEpoch: () => 2, getScope: () => 'scope',
    createMedia: async () => assert.fail('prepare'), createText: async () => assert.fail('recreate caption'), send: async () => assert.fail('resend'),
    reconcile: async (_id, message) => { checks++; assert.equal(message.clientMsgID, 'caption-delivered'); return true },
    persistence: { load: async () => [saved], retain: async () => assert.fail('retain'), save: async () => {}, remove: async () => {} },
  })
  await manager.restore()
  await manager.run('caption-task')
  assert.equal(checks, 1)
  assert.equal(manager.get('caption-task').status, 'completed')
})

test('completed batches do not exhaust the pending-task limit after 51 sequential sends', async () => {
  let sends = 0
  const manager = createAttachmentBatchManager({ getEpoch: () => 1, getScope: () => 'scope',
    createMedia: async () => ({ clientMsgID: `id-${sends}` }), createText: async () => ({}), send: async () => { sends++ },
    persistence: { retain: async (_scope, _id, media) => media, load: async () => [], save: async () => {}, remove: async () => {} },
  })
  for (let index = 0; index < 51; index++) {
    const batch = await manager.enqueue('chat', [{ type: 'file', uri: 'durable:file' }])
    await manager.run(batch.id)
    assert.equal(manager.get(batch.id).status, 'completed')
  }
  assert.equal(sends, 51)
  assert.equal(manager.list().length, 1)
})
