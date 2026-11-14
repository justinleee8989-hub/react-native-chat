import assert from 'node:assert/strict'
import test from 'node:test'
import { createProfileService } from './profile-service.ts'

for (const web of [false, true]) {
  test(`${web ? 'web' : 'native'} profiles normalize and preserve blocked friends`, async () => {
    const wrap = data => web ? { data } : data
    const calls = []
    const sdk = {
      getSelfUserInfo: async () => wrap({ userID: 'alice', nickname: 'Alice' }),
      getBlackList: async () => wrap([{ userID: 'bob' }]),
      getUsersInfo: async ids => wrap(ids.map(userID => ({ userID, nickname: userID === 'bob' ? 'Bob' : 'Stranger' }))),
      getSpecifiedFriendsInfo: async params => { calls.push(params); return wrap(params.friendUserIDList.includes('bob') ? [{ userID: 'bob', remark: 'B' }] : []) },
      updateFriends: async params => calls.push(params),
      setSelfInfo: async params => calls.push(params),
      addBlack: async params => calls.push(params),
      removeBlack: async id => calls.push(id),
    }
    const service = createProfileService(async () => sdk, value => web ? value.data : value)
    assert.equal((await service.self()).userID, 'alice')
    assert.equal((await service.person('bob')).remark, 'B')
    assert.equal((await service.person('stranger')).isFriend, false)
    assert.deepEqual(calls.shift(), { friendUserIDList: ['bob'], filterBlack: false })
    assert.deepEqual(calls.shift(), { friendUserIDList: ['stranger'], filterBlack: false })
    assert.equal((await service.blacklist())[0].userID, 'bob')
    await service.remark('bob', ' B2 ')
    assert.deepEqual(calls.shift(), { friendUserIDList: ['bob'], filterBlack: false })
    assert.deepEqual(calls.shift(), { friendUserIDs: ['bob'], remark: 'B2' })
    await service.updateSelf(' Alice 2 ', 'https://example.com/a.png')
    assert.deepEqual(calls.shift(), { nickname: 'Alice 2', faceURL: 'https://example.com/a.png' })
    await assert.rejects(service.updateSelf(' ', ''), /昵称/)
    await assert.rejects(service.updateSelf('Alice', 'file:///tmp/a'), /http/)
    await service.block('bob', true)
    await service.block('bob')
    assert.deepEqual(calls, [{ toUserID: 'bob' }, 'bob'])
  })
}
test('malformed profiles are errors, never empty successful states', async () => {
  const service = createProfileService(async () => ({ getSelfUserInfo: async () => ({}), getBlackList: async () => ({}) }), value => value)
  await assert.rejects(service.self(), /响应/)
  await assert.rejects(service.blacklist(), /响应/)
})
test('friend remarks recheck relationship and never call updateFriends for a stranger', async () => {
  let friend = false
  let updates = 0
  const service = createProfileService(async () => ({
    getSpecifiedFriendsInfo: async () => friend ? [{ userID: 'bob' }] : [],
    getUsersInfo: async () => [{ userID: 'bob', nickname: 'Bob' }],
    updateFriends: async () => { updates++ },
  }), value => value)

  assert.equal((await service.person('bob')).isFriend, false)
  await assert.rejects(service.remark('bob', 'note'), /仅好友/)
  assert.equal(updates, 0)

  friend = true
  assert.equal((await service.person('bob')).isFriend, true)
  await service.remark('bob', 'note')
  assert.equal(updates, 1)
})

test('global quiet mode preserves other profile fields and uses receive-without-notification value', async () => {
  const calls = []
  const service = createProfileService(async () => ({ setSelfInfo: async params => calls.push(params) }), value => value)
  await service.muteNotifications(true)
  await service.muteNotifications(false)
  assert.deepEqual(calls, [{ globalRecvMsgOpt: 2 }, { globalRecvMsgOpt: 0 }])
})
