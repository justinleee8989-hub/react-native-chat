import type { GroupApplication } from '../../domain/group-management'

type Page = { offset: number, count: number, groupIDs: string[], handleResults: number[] }
type Response = { groupID: string, fromUserID: string, handleMsg: string }
interface GroupManagementSDK {
  getGroupApplicationListAsRecipient: (params: Page) => Promise<unknown>
  getGroupApplicationListAsApplicant: (params: Page) => Promise<unknown>
  acceptGroupApplication: (params: Response) => Promise<unknown>
  refuseGroupApplication: (params: Response) => Promise<unknown>
  setGroupMemberInfo: (params: { groupID: string, userID: string, roleLevel: 20 | 60 }) => Promise<unknown>
  transferGroupOwner: (params: { groupID: string, newOwnerUserID: string }) => Promise<unknown>
  changeGroupMemberMute: (params: { groupID: string, userID: string, mutedSeconds: number }) => Promise<unknown>
  changeGroupMute: (params: { groupID: string, isMute: boolean }) => Promise<unknown>
  joinGroup: (params: { groupID: string, reqMsg: string, joinSource: 3 }) => Promise<unknown>
}
export function createGroupManagementService (getSDKClient: () => Promise<GroupManagementSDK>, unwrap: (value: unknown) => unknown) {
  return {
    requests: async (received: boolean, offset = 0): Promise<GroupApplication[]> => {
      const sdk = await getSDKClient()
      const params = { offset, count: 30, groupIDs: [], handleResults: [] }
      const data = unwrap(await (received ? sdk.getGroupApplicationListAsRecipient(params) : sdk.getGroupApplicationListAsApplicant(params)))
      if (!Array.isArray(data) || !data.every(item => item && typeof item.groupID === 'string' && typeof item.userID === 'string' && typeof item.handleResult === 'number'))
        throw new Error('OpenIM 群申请响应格式不正确，请检查 SDK 版本')
      return data
    },
    respond: async (groupID: string, fromUserID: string, accept: boolean, handleMsg = '') => {
      const sdk = await getSDKClient()
      const params = { groupID, fromUserID, handleMsg }
      return accept ? sdk.acceptGroupApplication(params) : sdk.refuseGroupApplication(params)
    },
    role: async (groupID: string, userID: string, admin: boolean) => (await getSDKClient()).setGroupMemberInfo({ groupID, userID, roleLevel: admin ? 60 : 20 }),
    transfer: async (groupID: string, newOwnerUserID: string) => (await getSDKClient()).transferGroupOwner({ groupID, newOwnerUserID }),
    muteMember: async (groupID: string, userID: string, mutedSeconds: number) => (await getSDKClient()).changeGroupMemberMute({ groupID, userID, mutedSeconds }),
    muteGroup: async (groupID: string, isMute: boolean) => (await getSDKClient()).changeGroupMute({ groupID, isMute }),
    join: async (groupID: string, reqMsg: string) => (await getSDKClient()).joinGroup({ groupID, reqMsg, joinSource: 3 }),
  }
}
