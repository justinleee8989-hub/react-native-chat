import assert from 'node:assert/strict'
import test from 'node:test'
import { createServerCallController } from './server-controller.ts'
import { zhT } from '../i18n/test-modules.mjs'
import { errorMessage } from '../shared/error-message.ts'

const room = 'imcall-55555555-5555-4555-8555-555555555555'

function call(status = 'ringing', overrides = {}) {
  return {
    room,
    caller: 'peer',
    callee: 'me',
    status,
    created: 1_000,
    expires: 46_000,
    members: {},
    ...overrides,
  }
}

function deferred() {
  let resolve
  let reject
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

function controllerFor(request, { record = async () => {}, now = () => 1_000 } = {}) {
  const controller = createServerCallController({ request, record, now })
  controller.reset('me')
  return controller
}

test('server denial leaves start and accept state unchanged and sends no signal', async () => {
  let recordCount = 0
  const deniedStart = controllerFor(async ({ action }) => {
    if (action === 'create')
      throw new Error('permission denied')
    return []
  }, { record: async () => { recordCount++ } })

  await assert.rejects(deniedStart.start('peer', 'Peer', 'request-id'), /permission denied/)
  assert.equal(deniedStart.snapshot().active, undefined)
  assert.equal(recordCount, 0)

  const deniedAccept = controllerFor(async ({ action }) => {
    if (action === 'list')
      return [call()]
    if (action === 'accept')
      throw new Error('call already ended')
    return []
  }, { record: async () => { recordCount++ } })

  await deniedAccept.poll()
  await assert.rejects(deniedAccept.accept(), /call already ended/)
  assert.equal(deniedAccept.snapshot().active.phase, 'incoming')
  assert.equal(recordCount, 0)
})

test('server terminal states end the active call and surface their matching notice', async () => {
  const notices = {
    ended: '通话已结束',
    canceled: '通话已取消',
    rejected: '已拒接通话',
    missed: '未接通话',
    disconnected: '连接中断，通话已结束',
  }

  for (const [status, notice] of Object.entries(notices)) {
    let current = call()
    const controller = controllerFor(async () => [current])
    await controller.poll()
    assert.ok(controller.snapshot().active, `${status}: ringing call should be active`)

    current = call(status, { ended: 2_000 })
    await controller.poll()
    assert.equal(controller.snapshot().active, undefined, `${status}: terminal call should be removed`)
    assert.equal(zhT(controller.snapshot().notice), notice, `${status}: terminal result should be visible`)
  }
})

test('heartbeat failures retain a call during the grace period and stop it after server state is stale', async () => {
  let now = 1_000
  const actions = []
  const activeCall = call('accepted', { caller: 'me', callee: 'peer', members: { me: { lease: 90_000 } } })
  const controller = controllerFor(async ({ action }) => {
    actions.push(action)
    if (action === 'heartbeat')
      throw new Error('heartbeat denied')
    return [activeCall]
  }, { now: () => now })

  await controller.start('peer', 'Peer', 'id')
  controller.mediaReady(room, true)
  now = 9_001
  controller.tick(); await new Promise(resolve => setImmediate(resolve))
  assert.equal(controller.snapshot().active.phase, 'connected')
  assert.equal(errorMessage(controller.snapshot().error, zhT), '')

  now = 17_002
  controller.tick(); await new Promise(resolve => setImmediate(resolve))
  assert.equal(controller.snapshot().active, undefined)
  assert.match(errorMessage(controller.snapshot().error, zhT), /无法确认服务端通话状态/)
  assert.deepEqual(actions, ['create', 'heartbeat', 'get', 'heartbeat', 'get'])
})

test('a connected call without ready media never sends a heartbeat', async () => {
  let now = 1_000
  const actions = []
  const activeCall = call('accepted', { caller: 'me', callee: 'peer', members: { me: { lease: 90_000 } } })
  const controller = controllerFor(async ({ action }) => {
    actions.push(action)
    return [activeCall]
  }, { now: () => now })

  await controller.start('peer', 'Peer', 'id')
  now = 9_001
  await controller.poll()

  assert.equal(controller.snapshot().active.phase, 'connected')
  assert.deepEqual(actions, ['create', 'list'])
})

test('logout during a pending accept prevents late server and record results from restoring the prior account', async () => {
  const acceptResponse = deferred()
  let recordCount = 0
  const controller = controllerFor(async ({ action }) => {
    if (action === 'list')
      return [call()]
    if (action === 'accept')
      return acceptResponse.promise
    return []
  }, { record: async () => { recordCount++ } })

  await controller.poll()
  const accepting = controller.accept()
  controller.reset('next-user')
  acceptResponse.resolve([call('accepted')])
  await accepting

  assert.deepEqual(controller.snapshot(), { error: '', notice: '', active: undefined, outcomes: {} })
  assert.equal(recordCount, 0)
})

test('an older poll cannot replace a newer accepted call or resurrect a finished call', async () => {
  const staleAcceptPoll = deferred()
  let acceptListCalls = 0
  const acceptedCall = call('accepted')
  const acceptedController = controllerFor(async ({ action }) => {
    if (action === 'list') {
      acceptListCalls++
      return acceptListCalls === 1 ? [call()] : staleAcceptPoll.promise
    }
    if (action === 'accept')
      return [acceptedCall]
    return []
  })

  await acceptedController.poll()
  const oldAcceptPoll = acceptedController.poll()
  await acceptedController.accept()
  assert.equal(acceptedController.snapshot().active.phase, 'connected')
  staleAcceptPoll.resolve([call()])
  await oldAcceptPoll
  assert.equal(acceptedController.snapshot().active.phase, 'connected')

  const staleFinishPoll = deferred()
  const finishedCall = call('ended', { caller: 'me', callee: 'peer', ended: 2_000 })
  const finishedController = controllerFor(async ({ action }) => {
    if (action === 'create')
      return [call('accepted', { caller: 'me', callee: 'peer' })]
    if (action === 'list')
      return staleFinishPoll.promise
    if (action === 'end')
      return [finishedCall]
    return []
  })

  await finishedController.start('peer', 'Peer', 'id')
  const oldFinishPoll = finishedController.poll()
  await finishedController.finish()
  staleFinishPoll.resolve([call('accepted', { caller: 'me', callee: 'peer' })])
  await oldFinishPoll
  assert.equal(finishedController.snapshot().active, undefined)
  assert.equal(zhT(finishedController.snapshot().notice), '通话已结束')
})

test('an accept response arriving after finish cannot revive a rejected call', async () => {
  const acceptResponse = deferred()
  const controller = controllerFor(async ({ action }) => {
    if (action === 'list')
      return [call()]
    if (action === 'accept')
      return acceptResponse.promise
    if (action === 'reject')
      return [call('rejected', { ended: 2_000 })]
    return []
  })

  await controller.poll()
  const accepting = controller.accept()
  await controller.finish()
  acceptResponse.resolve([call('accepted')])
  await accepting

  assert.equal(controller.snapshot().active, undefined)
  assert.equal(zhT(controller.snapshot().notice), '已拒接通话')
})

test('a group call clears when the server no longer lists the current user as a member', async () => {
  let current = call('accepted', {
    caller: 'owner',
    callee: '',
    groupID: 'group-1',
    members: { me: { lease: 90_000 }, owner: { lease: 90_000 } },
  })
  const controller = controllerFor(async () => [current])

  await controller.poll()
  assert.equal(controller.snapshot().active.phase, 'connected')

  current = call('accepted', {
    caller: 'owner',
    callee: '',
    groupID: 'group-1',
    members: { owner: { lease: 90_000 } },
  })
  await controller.poll()

  assert.equal(controller.snapshot().active, undefined)
  assert.equal(zhT(controller.snapshot().notice), '通话已结束')
})
