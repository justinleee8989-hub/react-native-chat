import assert from 'node:assert/strict'
import test from 'node:test'
import { createDirectoryService } from './directory-service.ts'

for (const web of [false, true]) {
  test(`${web ? 'web envelope' : 'native raw'} directory preserves pagination and friend request direction`, async () => {
    const wrap = value => web ? { data: value } : value
    const sdk = {
      getFriendListPage: async params => {
        assert.deepEqual(params, { offset: 30, count: 30, filterBlack: true })
        return wrap([{ userID: 'bob', nickname: 'Bob' }])
      },
      acceptFriendApplication: async params => {
        assert.deepEqual(params, { toUserID: 'applicant', handleMsg: '' })
        return wrap({})
      },
    }
    const service = createDirectoryService(async () => sdk, value => web ? value.data : value)
    assert.equal((await service.friends(30))[0].userID, 'bob')
    await service.respond('applicant', true)
  })
}
test('invalid list responses cannot masquerade as a successful empty directory', async () => {
  const service = createDirectoryService(async () => ({ getFriendListPage: async () => ({ unexpected: true }) }), value => value)
  await assert.rejects(service.friends(), /响应格式不正确/)
})
