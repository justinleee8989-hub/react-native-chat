import type { FriendRequest, Group, Person } from '../../domain/directory'

type Page = { offset: number, count: number }
type FriendAction = { toUserID: string, handleMsg: string }
type GroupAction = { groupID: string, userIDList: string[], reason: string }
interface DirectorySDK {
  getFriendListPage: (params: Page & { filterBlack: boolean }) => Promise<unknown>
  getUsersInfo: (ids: string[]) => Promise<unknown>
  getFriendApplicationListAsRecipient: (params: Page & { handleResults: [] }) => Promise<unknown>
  getFriendApplicationListAsApplicant: (params: Page) => Promise<unknown>
  addFriend: (params: { toUserID: string, reqMsg: string }) => Promise<unknown>
  acceptFriendApplication: (params: FriendAction) => Promise<unknown>
  refuseFriendApplication: (params: FriendAction) => Promise<unknown>
  deleteFriend: (id: string) => Promise<unknown>
  getJoinedGroupListPage: (params: Page) => Promise<unknown>
  getSpecifiedGroupsInfo: (ids: string[]) => Promise<unknown>
  getGroupMemberList: (params: Page & { groupID: string, filter: 0 }) => Promise<unknown>
  getSpecifiedGroupMembersInfo: (params: {
    groupID: string
    userIDList: string[]
  }) => Promise<unknown>
  createGroup: (params: {
    groupInfo: { groupName: string, groupType: 2 }
    memberUserIDs: string[]
  }) => Promise<unknown>
  setGroupInfo: (params: {
    groupID: string
    groupName: string
    notification: string
  }) => Promise<unknown>
  inviteUserToGroup: (params: GroupAction) => Promise<unknown>
  kickGroupMember: (params: GroupAction) => Promise<unknown>
  quitGroup: (id: string) => Promise<unknown>
  dismissGroup: (id: string) => Promise<unknown>
}

/** One application contract, with response envelopes confined to the platform entry points. */
export function createDirectoryService (
  getSDKClient: () => Promise<DirectorySDK>,
  unwrap: (value: unknown) => unknown
) {
  function list<T>(value: unknown, valid: (item: any) => boolean): T[] {
    const data = unwrap(value)
    if (!Array.isArray(data) || !data.every(item => item && valid(item)))
      throw new Error('XIM 目录响应格式不正确，请检查 SDK 版本')
    return data
  }
  const people = (value: unknown) => list<Person>(value, item => typeof item.userID === 'string')
  const groups = (value: unknown) =>
    list<Group>(
      value,
      item => typeof item.groupID === 'string' && typeof item.groupName === 'string'
    )
  const requests = (value: unknown) =>
    list<FriendRequest>(
      value,
      item => typeof item.fromUserID === 'string' && typeof item.toUserID === 'string'
    )
  const group = (value: unknown): Group => {
    const data = unwrap(value) as Group | undefined
    if (!data || typeof data.groupID !== 'string' || typeof data.groupName !== 'string')
      throw new Error('XIM 群组响应格式不正确，请检查 SDK 版本')
    return data
  }
  return {
    friends: async (offset = 0) =>
      people(
        await (await getSDKClient()).getFriendListPage({ offset, count: 30, filterBlack: true })
      ),
    users: async (id: string) => {
      try {
        return people(await (await getSDKClient()).getUsersInfo([id]))
      } catch (reason) {
        const error = reason as { errMsg?: unknown, message?: unknown }
        const message = typeof error?.errMsg === 'string' ? error.errMsg : typeof error?.message === 'string' ? error.message : typeof reason === 'string' ? reason : ''
        if (/user\s*(?:id)?\s*(?:not found|does not exist|not exist)/i.test(message))
          return []
        throw reason
      }
    },
    requests: async (received: boolean, offset = 0) => {
      const sdk = await getSDKClient()
      return requests(
        await (received
          ? sdk.getFriendApplicationListAsRecipient({ offset, count: 30, handleResults: [] })
          : sdk.getFriendApplicationListAsApplicant({ offset, count: 30 }))
      )
    },
    add: async (toUserID: string, reqMsg: string) =>
      (await getSDKClient()).addFriend({ toUserID, reqMsg }),
    respond: async (toUserID: string, accept: boolean) => {
      const sdk = await getSDKClient()
      return accept
        ? sdk.acceptFriendApplication({ toUserID, handleMsg: '' })
        : sdk.refuseFriendApplication({ toUserID, handleMsg: '' })
    },
    removeFriend: async (id: string) => (await getSDKClient()).deleteFriend(id),
    groups: async (offset = 0) =>
      groups(await (await getSDKClient()).getJoinedGroupListPage({ offset, count: 30 })),
    group: async (id: string) =>
      groups(await (await getSDKClient()).getSpecifiedGroupsInfo([id]))[0],
    members: async (groupID: string, offset = 0) =>
      people(
        await (await getSDKClient()).getGroupMemberList({ groupID, offset, count: 30, filter: 0 })
      ),
    member: async (groupID: string, userID: string) =>
      people(
        await (
          await getSDKClient()
        ).getSpecifiedGroupMembersInfo({ groupID, userIDList: [userID] })
      )[0],
    create: async (groupName: string, memberUserIDs: string[]) =>
      group(
        await (
          await getSDKClient()
        ).createGroup({ groupInfo: { groupName, groupType: 2 }, memberUserIDs })
      ),
    update: async (groupID: string, groupName: string, notification: string) =>
      (await getSDKClient()).setGroupInfo({ groupID, groupName, notification }),
    invite: async (groupID: string, userIDList: string[]) =>
      (await getSDKClient()).inviteUserToGroup({ groupID, userIDList, reason: '' }),
    kick: async (groupID: string, id: string) =>
      (await getSDKClient()).kickGroupMember({ groupID, userIDList: [id], reason: '' }),
    leave: async (id: string) => (await getSDKClient()).quitGroup(id),
    dismiss: async (id: string) => (await getSDKClient()).dismissGroup(id),
  }
}
