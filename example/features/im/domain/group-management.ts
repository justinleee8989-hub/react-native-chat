import type { MessageKey, Translate } from '../i18n/translate.ts'
import { ProductError } from '../shared/product-error.ts'
import type { Person } from './directory'

export interface GroupApplication {
  groupID: string
  groupName?: string
  userID: string
  nickname?: string
  userFaceURL?: string
  reqMsg?: string
  handledMsg?: string
  handleResult: number
  reqTime?: number
}

/** Conservative UI gates; the deployed server remains authoritative. */
export function groupManagementPermissions (self?: Person, target?: Person) {
  const owner = self?.roleLevel === 100
  const manage = owner || self?.roleLevel === 60
  const other = !!self && !!target && self.userID !== target.userID
  const lower = other && (self.roleLevel || 0) > (target.roleLevel || 0)
  return {
    manage,
    role: owner && other && target.roleLevel !== 100,
    transfer: owner && other && (target.roleLevel === 20 || target.roleLevel === 60),
    muteMember: manage && lower,
  }
}

export type GroupManagementPermission = 'manage' | 'role' | 'transfer' | 'muteMember'

export function assertGroupManagement (
  current: boolean,
  permission: GroupManagementPermission,
  self?: Person,
  target?: Person
) {
  if (!current)
    throw new ProductError('group.chatChanged')
  if (!groupManagementPermissions(self, target)[permission])
    throw new ProductError('group.permissionChanged')
}


/** The name of a member's role: 100 is the owner, 60 an admin, anything else a member. */
export function roleKey (level?: number): MessageKey {
  return level === 100 ? 'role.owner' : level === 60 ? 'role.admin' : 'role.member'
}

export function groupMuteLabel (status: number | undefined, tr: Translate) {
  if (status === undefined)
    return tr('group.statusLoading')
  if (status === 3)
    return tr('group.mutedAll')
  if (status === 0)
    return tr('group.notMutedAll')
  return status === 2 ? tr('group.dismissed') : tr('group.unavailable')
}

export function memberMuteLabel (endTime: number | undefined, tr: Translate, now = Date.now() / 1000) {
  // SDK releases expose deadlines in milliseconds; accept seconds from older caches.
  const seconds = endTime && endTime > 100000000000 ? endTime / 1000 : endTime
  if (!seconds || seconds <= now)
    return tr('group.memberNotMuted')
  return tr('group.memberMutedUntil', { time: new Date(seconds * 1000).toLocaleString(tr.locale, { hour12: false }) })
}
