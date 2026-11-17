import type { ProfilePatch } from '../../domain/profile'
import { getSDKClient } from './client'
import { createProfileService } from './profile-service'
import { fetchSelfProfile } from './self-profile-api'

export const profile = createProfileService(async () => {
  const sdk = await getSDKClient()
  return {
    getSelfUserInfo: () => sdk.getSelfUserInfo(),
    setSelfInfo: (params: ProfilePatch) => sdk.setSelfInfo(params),
    getUsersInfo: (ids: string[]) => sdk.getUsersInfo(ids),
    getSpecifiedFriendsInfo: (params: { friendUserIDList: string[], filterBlack: boolean }) => sdk.getSpecifiedFriendsInfo({ userIDList: params.friendUserIDList, filterBlack: params.filterBlack }),
    updateFriends: (params: { friendUserIDs: string[], remark: string }) => sdk.updateFriends(params),
    getBlackList: () => sdk.getBlackList(),
    addBlack: (params: { toUserID: string }) => sdk.addBlack(params),
    removeBlack: (id: string) => sdk.removeBlack(id),
  }
}, value => value, fetchSelfProfile)
