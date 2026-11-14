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
    throw new Error('会话已变化，请重新操作')
  if (!groupManagementPermissions(self, target)[permission])
    throw new Error('群成员或权限已变化，请刷新后重试')
}


export function groupMuteLabel (status?: number) {
  if (status === undefined)
    return '群状态尚未加载'
  if (status === 3)
    return '全员禁言已开启'
  if (status === 0)
    return '全员禁言未开启'
  return status === 2 ? '群组已解散' : '群组当前不可用'
}

export function memberMuteLabel (endTime?: number, now = Date.now() / 1000) {
  // SDK releases expose deadlines in milliseconds; accept seconds from older caches.
  const seconds = endTime && endTime > 100000000000 ? endTime / 1000 : endTime
  if (!seconds || seconds <= now)
    return '未单独禁言'
  return `单独禁言至 ${new Date(seconds * 1000).toLocaleString('zh-CN', { hour12: false })}`
}
