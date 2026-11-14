import assert from 'node:assert/strict'
import test from 'node:test'
import { createGroupManagementService } from './group-management-service.ts'

for (const web of [false, true]) {
  test(`${web ? 'web' : 'native'} group requests use SDK userID as fromUserID and preserve paging`, async () => {
    const wrap = value => web ? { data: value } : value
    const calls = []
    const sdk = Object.fromEntries(['acceptGroupApplication', 'refuseGroupApplication', 'setGroupMemberInfo', 'transferGroupOwner', 'changeGroupMemberMute', 'changeGroupMute', 'joinGroup'].map(method => [method, async params => { calls.push([method, params]); return wrap({}) }]))
    for (const method of ['getGroupApplicationListAsRecipient', 'getGroupApplicationListAsApplicant'])
      sdk[method] = async params => { assert.deepEqual(params, { offset: 30, count: 30, groupIDs: [], handleResults: [] }); return wrap([{ groupID: 'g', userID: 'applicant', handleResult: 0 }]) }
    const service = createGroupManagementService(async () => sdk, value => web ? value.data : value)
    assert.equal((await service.requests(true, 30))[0].userID, 'applicant')
    assert.equal((await service.requests(false, 30))[0].groupID, 'g')
    await service.respond('g', 'applicant', true, 'welcome')
    await service.respond('g', 'applicant', false, 'reason')
    await service.role('g', 'member', true)
    await service.role('g', 'member', false)
    await service.transfer('g', 'member')
    await service.muteMember('g', 'member', 3600)
    await service.muteMember('g', 'member', 0)
    await service.muteGroup('g', true)
    await service.join('g', 'hello')
    assert.deepEqual(calls, [
      ['acceptGroupApplication', { groupID: 'g', fromUserID: 'applicant', handleMsg: 'welcome' }],
      ['refuseGroupApplication', { groupID: 'g', fromUserID: 'applicant', handleMsg: 'reason' }],
      ['setGroupMemberInfo', { groupID: 'g', userID: 'member', roleLevel: 60 }],
      ['setGroupMemberInfo', { groupID: 'g', userID: 'member', roleLevel: 20 }],
      ['transferGroupOwner', { groupID: 'g', newOwnerUserID: 'member' }],
      ['changeGroupMemberMute', { groupID: 'g', userID: 'member', mutedSeconds: 3600 }],
      ['changeGroupMemberMute', { groupID: 'g', userID: 'member', mutedSeconds: 0 }],
      ['changeGroupMute', { groupID: 'g', isMute: true }],
      ['joinGroup', { groupID: 'g', reqMsg: 'hello', joinSource: 3 }],
    ])
  })
}
test('malformed applications are rejected rather than shown as empty', async () => {
  const service = createGroupManagementService(async () => ({ getGroupApplicationListAsRecipient: async () => [{ groupID: 'g', fromUserID: 'bad' }] }), value => value)
  await assert.rejects(service.requests(true), /响应格式/)
})
