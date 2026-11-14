export interface Person {
  userID: string
  nickname?: string
  remark?: string
  faceURL?: string
  isFriend?: boolean
  roleLevel?: number
  muteEndTime?: number
}
export interface Group {
  groupID: string
  groupName: string
  notification?: string
  faceURL?: string
  memberCount?: number
  needVerification?: number
  status?: number
}
export interface FriendRequest {
  fromUserID: string
  toUserID: string
  fromNickname?: string
  toNickname?: string
  reqMsg?: string
  handleResult: number
}
export function groupPermissions (member?: { roleLevel?: number }, needVerification = 0) {
  const role = member?.roleLevel || 0
  return {
    manage: role >= 60,
    dismiss: role === 100,
    leave: role > 0 && role < 100,
    invite: role > 0,
    inviteNeedsApproval: role > 0 && role < 60 && needVerification === 1,
  }
}
export function canRemoveMember (self: Person | undefined, target: Person) {
  return (
    !!self &&
    self.userID !== target.userID &&
    (self.roleLevel || 0) >= 60 &&
    (self.roleLevel || 0) > (target.roleLevel || 0)
  )
}
export function mergeDirectory<T>(previous: T[], incoming: T[], key: (item: T) => string): T[] {
  return [...new Map([...previous, ...incoming].map(item => [key(item), item])).values()]
}
