import type { Person } from '../../domain/directory'
import type { ProfilePatch, SelfProfile } from '../../domain/profile'
import type { Session } from '../../domain/types'
import type { SelfProfileIdentity } from './self-profile-api'

interface ProfileSDK {
  getSelfUserInfo: () => Promise<unknown>
  setSelfInfo: (params: ProfilePatch) => Promise<unknown>
  getUsersInfo: (ids: string[]) => Promise<unknown>
  getSpecifiedFriendsInfo: (params: { friendUserIDList: string[], filterBlack: boolean }) => Promise<unknown>
  updateFriends: (params: { friendUserIDs: string[], remark: string }) => Promise<unknown>
  getBlackList: () => Promise<unknown>
  addBlack: (params: { toUserID: string }) => Promise<unknown>
  removeBlack: (id: string) => Promise<unknown>
}
export function createProfileService (
  getSDK: () => Promise<ProfileSDK>,
  unwrap: (value: unknown) => unknown,
  fetchSelfProfile?: (session: Session, baseURL: string) => Promise<SelfProfileIdentity>
) {
  function person (value: unknown): Person {
    if (!value || typeof value !== 'object' || !('userID' in value) || typeof value.userID !== 'string')
      throw new Error('OpenIM 用户资料响应格式不正确')
    return value as Person
  }
  function list (value: unknown): Person[] {
    const data = unwrap(value)
    if (!Array.isArray(data))
      throw new Error('OpenIM 用户列表响应格式不正确')
    return data.map(person)
  }
  return {
    self: async (auth?: { session: Session, baseURL: string }) => {
      const user = person(unwrap(await (await getSDK()).getSelfUserInfo())) as SelfProfile
      if (!auth || !fetchSelfProfile)
        return user
      try {
        const accountProfile = await fetchSelfProfile(auth.session, auth.baseURL)
        if (accountProfile.userID === auth.session.userID && accountProfile.userID === user.userID)
          return { ...user, email: accountProfile.email }
      } catch {
        // A ChatServer lookup failure should not hide the SDK profile.
      }
      return user
    },
    person: async (id: string) => {
      const sdk = await getSDK()
      const friends = list(await sdk.getSpecifiedFriendsInfo({ friendUserIDList: [id], filterBlack: false }))
      const friend = friends.find(user => user.userID === id)
      if (friend)
        return { ...friend, isFriend: true }
      const users = list(await sdk.getUsersInfo([id]))
      const user = users.find(item => item.userID === id)
      return user && { ...user, isFriend: false }
    },
    blacklist: async () => list(await (await getSDK()).getBlackList()),
    updateSelf: async (nickname: string, faceURL: string) => {
      nickname = nickname.trim()
      faceURL = faceURL.trim()
      if (!nickname)
        throw new Error('昵称不能为空')
      if (faceURL && !/^https?:\/\/[^\s]+$/.test(faceURL))
        throw new Error('头像地址必须是 http 或 https 图片地址')
      return (await getSDK()).setSelfInfo({ nickname, faceURL })
    },
    muteNotifications: async (muted: boolean) => (await getSDK()).setSelfInfo({ globalRecvMsgOpt: muted ? 2 : 0 }),
    remark: async (id: string, remark: string) => {
      const sdk = await getSDK()
      const friends = list(await sdk.getSpecifiedFriendsInfo({ friendUserIDList: [id], filterBlack: false }))
      if (!friends.some(user => user.userID === id))
        throw new Error('仅好友可设置好友备注')
      return sdk.updateFriends({ friendUserIDs: [id], remark: remark.trim() })
    },
    block: async (id: string, blocked: boolean) => {
      const sdk = await getSDK()
      return blocked ? sdk.addBlack({ toUserID: id }) : sdk.removeBlack(id)
    },
  }
}
