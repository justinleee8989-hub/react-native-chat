import SDK, { OpenIMEmitter } from '@openim/rn-client-sdk'
import { Directory, Paths } from 'expo-file-system'
import type { IMClient } from '../../domain/types'
import { createNativeMedia } from './media'

let initialized = false
export const client: IMClient = {
  async login(session, config) {
    if (!initialized) {
      const directory = new Directory(Paths.document, 'openim')
      directory.create({ intermediates: true, idempotent: true })
      await SDK.initSDK({
        apiAddr: config.api,
        wsAddr: config.ws,
        dataDir: directory.uri.replace('file://', ''),
        logFilePath: directory.uri.replace('file://', ''),
        logLevel: 1,
        isLogStandardOutput: false,
      })
      initialized = true
    }
    await SDK.login({ userID: session.userID, token: session.imToken })
  },
  async logout() {
    try {
      await SDK.logout()
    } finally {
      initialized = false
      await SDK.unInitSDK()
    }
  },
  on(event, handler) {
    const listener = OpenIMEmitter.addListener(
      event === 'onProgress' ? 'SendMessageProgress' : event,
      handler
    )
    return () => listener.remove()
  },
  conversations: offset => SDK.getConversationListSplit({ offset, count: 100 }),
  conversation: (sourceID, sessionType = 1) => SDK.getOneConversation({ sourceID, sessionType }),
  history: (conversationID, startClientMsgID) =>
    SDK.getAdvancedHistoryMessageList({ conversationID, startClientMsgID, count: 30, viewType: 0 }),
  createMedia: media => createNativeMedia(media),
  createText: text => SDK.createTextMessage(text),
  createQuote: (text, message) => SDK.createQuoteMessage({ text, message: message as Parameters<typeof SDK.createForwardMessage>[0] }),
  createForward: message => SDK.createForwardMessage(message as Parameters<typeof SDK.createForwardMessage>[0]),
  revoke: (conversationID, clientMsgID) => SDK.revokeMessage({ conversationID, clientMsgID }),
  async search(conversationID, keyword, pageIndex) {
    const result = await SDK.searchLocalMessages({ conversationID, keywordList: [keyword], pageIndex, count: 30 })
    return { messages: result.searchResultItems?.flatMap(item => item.messageList) || [], total: result.totalCount }
  },
  send: (message, conversation) =>
    SDK.sendMessage({
      message: message as Parameters<typeof SDK.sendMessage>[0]['message'],
      recvID: conversation.userID || '',
      groupID: conversation.groupID || '',
    }),
  read: conversationID => SDK.markConversationMessageAsRead(conversationID),
}

export async function getSDKClient () {
  return SDK
}
