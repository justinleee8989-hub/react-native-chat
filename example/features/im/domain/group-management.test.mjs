import assert from 'node:assert/strict'
import test from 'node:test'
import { groupManagementPermissions } from './group-management.ts'
import { zhT } from '../i18n/test-modules.mjs'

test('owner/admin gates protect self, owners and peer administrators', () => {
  const owner = { userID: 'owner', roleLevel: 100 }
  const admin = { userID: 'admin', roleLevel: 60 }
  const member = { userID: 'member', roleLevel: 20 }
  assert.deepEqual(groupManagementPermissions(owner, admin), { manage: true, role: true, transfer: true, muteMember: true })
  assert.equal(groupManagementPermissions(admin, owner).muteMember, false)
  assert.equal(groupManagementPermissions(admin, admin).muteMember, false)
  assert.equal(groupManagementPermissions(admin, member).muteMember, true)
  assert.equal(groupManagementPermissions(admin, member).role, false)
  assert.equal(groupManagementPermissions(owner, owner).transfer, false)
  assert.equal(groupManagementPermissions(undefined, member).manage, false)
})

test('confirmation recheck rejects stale session and revoked privileges', async () => {
  const { assertGroupManagement } = await import('./group-management.ts')
  assert.equal(typeof assertGroupManagement, 'function')
  assert.throws(() => assertGroupManagement(false, 'manage', { userID: 'owner', roleLevel: 100 }), /会话/)
  assert.throws(() => assertGroupManagement(true, 'manage', { userID: 'owner', roleLevel: 20 }), /权限/)
  assert.throws(() => assertGroupManagement(true, 'transfer', { userID: 'owner', roleLevel: 100 }), /权限/)
  assert.doesNotThrow(() => assertGroupManagement(true, 'muteMember', { userID: 'admin', roleLevel: 60 }, { userID: 'member', roleLevel: 20 }))
})

test('mute labels distinguish unknown, active and expired server values', async () => {
  const { groupMuteLabel, memberMuteLabel } = await import('./group-management.ts')
  assert.equal(groupMuteLabel(undefined, zhT), '群状态尚未加载')
  assert.equal(groupMuteLabel(3, zhT), '全员禁言已开启')
  assert.equal(groupMuteLabel(0, zhT), '全员禁言未开启')
  assert.equal(memberMuteLabel(999, zhT, 1000), '未单独禁言')
  assert.equal(memberMuteLabel(0, zhT, 1000), '未单独禁言')
  assert.match(memberMuteLabel(1060, zhT, 1000), /^单独禁言至 /)
})

test('SDK millisecond mute deadline displays the actual date', async () => {
  const { memberMuteLabel } = await import('./group-management.ts')
  const seconds = 1794647100
  assert.equal(memberMuteLabel(seconds * 1000, zhT, seconds - 60), memberMuteLabel(seconds, zhT, seconds - 60))
  assert.equal(memberMuteLabel(seconds * 1000, zhT, seconds + 1), '未单独禁言')
})
