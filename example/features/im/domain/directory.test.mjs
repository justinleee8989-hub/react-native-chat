import test from 'node:test'
import assert from 'node:assert/strict'
import { canRemoveMember, groupPermissions, mergeDirectory } from './directory.ts'
test('administrators cannot remove equal or higher roles or themselves', () => {
  assert.equal(canRemoveMember({ userID: 'me', roleLevel: 60 }, { userID: 'owner', roleLevel: 100 }), false)
  assert.equal(canRemoveMember({ userID: 'me', roleLevel: 60 }, { userID: 'admin', roleLevel: 60 }), false)
  assert.equal(canRemoveMember({ userID: 'me', roleLevel: 100 }, { userID: 'me', roleLevel: 100 }), false)
  assert.equal(canRemoveMember({ userID: 'me', roleLevel: 60 }, { userID: 'other', roleLevel: 20 }), true)
})
test('missing membership denies actions and owner cannot leave', () => {
  assert.deepEqual(groupPermissions(undefined), { manage: false, dismiss: false, leave: false, invite: false, inviteNeedsApproval: false })
  assert.equal(groupPermissions({ roleLevel: 100 }).leave, false)
  assert.equal(groupPermissions({ roleLevel: 100 }).dismiss, true)

})
test('paged directory replaces duplicates without losing earlier pages', () => {
  assert.deepEqual(mergeDirectory([{ userID: 'a', nickname: 'old' }], [{ userID: 'a', nickname: 'new' }, { userID: 'b' }], item => item.userID), [{ userID: 'a', nickname: 'new' }, { userID: 'b' }])
})

test('ordinary members may invite in approval groups with a pending-review outcome', () => {
  assert.equal(groupPermissions({ roleLevel: 20 }, 1).invite, true)
  assert.equal(groupPermissions({ roleLevel: 20 }, 1).inviteNeedsApproval, true)
  assert.equal(groupPermissions({ roleLevel: 60 }, 1).inviteNeedsApproval, false)
  assert.equal(groupPermissions({ roleLevel: 20 }, 0).inviteNeedsApproval, false)
})

test('directory event subscriptions scope groups and stop invalidating after cleanup', async () => {
  const { subscribeDirectoryEvents, groupDirectoryEvents } = await import('./directory-events.ts')
  const callbacks = new Map()
  let refreshes = 0
  let removed = 0
  const cleanup = subscribeDirectoryEvents((event, callback) => {
    callbacks.set(event, callback)
    return () => { removed++ }
  }, groupDirectoryEvents, () => { refreshes++ }, 'g')
  callbacks.get('onGroupInfoChanged')({ groupID: 'other' })
  assert.equal(refreshes, 0)
  callbacks.get('onGroupInfoChanged')({ groupID: 'g' })
  callbacks.get('onGroupMemberInfoChanged')({ groupID: 'g', roleLevel: 60 })
  assert.equal(refreshes, 2)
  cleanup()
  callbacks.get('onGroupMemberAdded')({ groupID: 'g' })
  assert.equal(refreshes, 2)
  assert.equal(removed, groupDirectoryEvents.length)
})


test('initial synchronization invalidates both contact and group directories', async () => {
  const { subscribeDirectoryEvents, contactDirectoryEvents, groupDirectoryEvents } = await import('./directory-events.ts')
  for (const events of [contactDirectoryEvents, groupDirectoryEvents]) {
    const callbacks = new Map()
    let refreshes = 0
    const cleanup = subscribeDirectoryEvents((event, callback) => {
      callbacks.set(event, callback)
      return () => callbacks.delete(event)
    }, events, () => { refreshes++ }, 'group')
    assert.equal(typeof callbacks.get('onSyncServerFinish'), 'function')
    callbacks.get('onSyncServerFinish')({})
    assert.equal(refreshes, 1)
    cleanup()
    assert.equal(callbacks.size, 0)
  }
})
