import { parseInputStatus } from '../../application/composer-state'
import { ProductError } from '../../shared/product-error.ts'
import { client, getSDKClient } from './client'
import { getDraftStorageScope, readLocalDraft, writeLocalDraft } from './composer-storage'

type ComposerSDK = {
  getSelfUserInfo: (operationID?: string) => Promise<unknown>
  getMultipleConversation: (conversationIDList: string[], operationID?: string) => Promise<unknown>
  setConversationDraft: (params: { conversationID: string, draftText: string }, operationID?: string) => Promise<unknown>
  changeInputStates: (params: { conversationID: string, focus: boolean }, operationID?: string) => Promise<unknown>
  createTextAtMessage: (params: { text: string, atUserIDList: string[], atUsersInfo?: { atUserID: string, groupNickname: string }[] }, operationID?: string) => Promise<unknown>
  getGroupMemberList: (params: { groupID: string, offset: number, count: number, filter: 0 }, operationID?: string) => Promise<unknown>
}

const operationID = () => `composer-${Date.now()}-${Math.random().toString(36).slice(2)}`
const dataOf = (value: unknown): any => (value as { data?: unknown })?.data ?? value

export async function readDraft (userID: string, conversationID: string) {
  const local = await readLocalDraft(userID, conversationID)
  if (local !== undefined)
    return local
  const sdk = await getSDKClient() as ComposerSDK
  const self = dataOf(await sdk.getSelfUserInfo(operationID()))
  if (self?.userID !== userID)
    return ''
  const conversations = dataOf(await sdk.getMultipleConversation([conversationID], operationID()))
  if (!Array.isArray(conversations))
    return ''
  return conversations.find(item => item?.conversationID === conversationID)?.draftText || ''
}

export async function writeDraft (userID: string, conversationID: string, text: string) {
  const scope = getDraftStorageScope()
  await writeLocalDraft(userID, conversationID, text)
  const sdk = await getSDKClient() as ComposerSDK
  const self = dataOf(await sdk.getSelfUserInfo(operationID()))
  if (self?.userID !== userID)
    return
  if (scope !== getDraftStorageScope())
    return
  return sdk.setConversationDraft({ conversationID, draftText: text }, operationID())
}

export async function changeInputState (conversationID: string, focus: boolean) {
  const sdk = await getSDKClient() as ComposerSDK
  return sdk.changeInputStates({ conversationID, focus }, operationID())
}

export async function createAtMessage (text: string, members: { userID: string, nickname?: string }[]) {
  const sdk = await getSDKClient() as ComposerSDK
  return dataOf(await sdk.createTextAtMessage({
    text,
    atUserIDList: members.map(member => member.userID),
    atUsersInfo: members.map(member => ({ atUserID: member.userID, groupNickname: member.nickname || member.userID })),
  }, operationID()))
}

export async function listGroupMembers (groupID: string) {
  const sdk = await getSDKClient() as ComposerSDK
  const self = dataOf(await sdk.getSelfUserInfo(operationID()))
  if (typeof self?.userID !== 'string')
    throw new ProductError('composer.noAccount')
  const pageSize = 100
  const members = new Map<string, { userID: string, nickname: string, faceURL?: string, roleLevel?: number }>()
  for (let offset = 0; ; ) {
    const page = dataOf(await sdk.getGroupMemberList({ groupID, offset, count: pageSize, filter: 0 }, operationID()))
    if (!Array.isArray(page))
      throw new ProductError('composer.badMembers')
    const previousCount = members.size
    for (const member of page)
      if (typeof member?.userID === 'string' && member.userID !== self.userID)
        members.set(member.userID, { userID: member.userID, nickname: member.nickname || member.userID, faceURL: member.faceURL, roleLevel: member.roleLevel })

    if (page.length < pageSize)
      break
    offset += page.length
    if (members.size === previousCount)
      break
  }
  return [...members.values()]
}

export function subscribeInputStatus (listener: (status: { conversationID: string, userID: string, platformIDs: number[] }) => void) {
  return client.on('onInputStatusChanged', value => {
    const status = parseInputStatus(value)
    if (status)
      listener(status)
  })
}
