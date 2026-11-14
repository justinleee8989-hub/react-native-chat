import { updateConversationArchiveEx } from '../../domain/conversation-archive.ts'

interface ConversationSDK {
  setConversation: (params: { conversationID: string, isPinned?: boolean, recvMsgOpt?: 0 | 2, ex?: string }) => Promise<unknown>
  clearConversationAndDeleteAllMsg: (id: string) => Promise<unknown>
  deleteConversationAndDeleteAllMsg: (id: string) => Promise<unknown>
}
export function createConversationService (
  getSDK: () => Promise<ConversationSDK>,
  getLatestConversation?: (sourceID: string, sessionType: number) => Promise<{ ex?: string }>
) {
  return {
    pin: async (conversationID: string, isPinned: boolean) => (await getSDK()).setConversation({ conversationID, isPinned }),
    mute: async (conversationID: string, muted: boolean) => (await getSDK()).setConversation({ conversationID, recvMsgOpt: muted ? 2 : 0 }),
    archive: async (conversationID: string, ex: string | undefined, userID: string, archived: boolean, sessionType = 1, sourceID = conversationID) => {
      const latest = await getLatestConversation?.(sourceID, sessionType)
      const nextEx = updateConversationArchiveEx(latest ? latest.ex : ex, userID, archived)
      await (await getSDK()).setConversation({ conversationID, ex: nextEx, ...(archived ? { isPinned: false } : {}) })
      return nextEx
    },
    clear: async (id: string) => (await getSDK()).clearConversationAndDeleteAllMsg(id),
    remove: async (id: string) => (await getSDK()).deleteConversationAndDeleteAllMsg(id),
  }
}
export type ConversationService = ReturnType<typeof createConversationService>
