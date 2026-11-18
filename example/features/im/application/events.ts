import { mergeMessages } from '../domain/model'
import type { Conversation, IMClient, IMMessage } from '../domain/types'
import { groupReadNotice } from './group-read-notice'
import type { Messaging } from './messaging'
import type { Runtime } from './runtime'

export function subscribeEvents (
  client: IMClient,
  runtime: Runtime,
  messaging: Messaging,
  logout: (error: string) => Promise<void>,
  epoch: number,
  receiveCall: (message: IMMessage) => void = () => {}
) {
  const disposers: (() => void)[] = []
  const on = (event: string, handler: (data: unknown) => void) => {
    disposers.push(
      client.on(event, data => {
        if (epoch === runtime.generation)
          handler(data)
      })
    )
  }
  on('onProgress', data => {
    const event = data as { clientMsgID?: string, progress: number, message?: IMMessage }
    const messageID = event.clientMsgID || event.message?.clientMsgID
    for (const [id, messages] of Object.entries(runtime.state.messages)) {
      const message = messages.find(item => item.clientMsgID === messageID && item.status === 1)
      if (message)
        runtime.addMessages(id, [
          { ...message, uploadProgress: Math.max(0, Math.min(100, event.progress)) },
        ])
    }
  })
  on('onConnecting', () => runtime.update({ status: '连接中' }))
  on('onConnectSuccess', () => runtime.update({ status: '已连接' }))
  on('onConnectFailed', () => runtime.update({ status: '连接断开，正在重连' }))
  on('onSyncServerStart', () => runtime.update({ status: '同步中' }))
  on('onSyncServerFinish', () => {
    runtime.update({ status: '已连接' })
    const id = runtime.activeID
    void messaging
      .refresh()
      .then(() => {
        if (epoch === runtime.generation && id && id === runtime.activeID)
          return messaging.loadHistory(id)
      })
      .catch(error => {
        if (epoch === runtime.generation)
          runtime.reportError(error)
      })
  })
  on('onSyncServerFailed', () => runtime.update({ error: '同步失败，请刷新会话重试' }))
  for (const event of ['onKickedOffline', 'onUserTokenExpired', 'onUserTokenInvalid'])
    on(event, () => {
      void logout('登录已失效，请重新登录')
    })
  for (const event of ['onConversationChanged', 'onNewConversation'])
    on(event, data => runtime.mergeConversations(data as Conversation[]))
  const receive = (data: unknown) => {
    const incoming = (Array.isArray(data) ? data : [data]) as IMMessage[]
    incoming.forEach(receiveCall)
    // SDK message callbacks can precede the new-conversation callback.
    runtime.pendingMessages = mergeMessages(runtime.pendingMessages, incoming)
    runtime.drainMessages()
    if (runtime.activeID)
      void client.read(runtime.activeID).catch(error => {
        if (epoch === runtime.generation)
          runtime.reportError(error)
      })
    void messaging.refresh().catch(error => {
      if (epoch === runtime.generation)
        runtime.reportError(error)
    })
  }
  on('onNewRecvMessageRevoked', data => {
    const info = data as { clientMsgID: string, revokerNickname?: string }
    for (const [id, messages] of Object.entries(runtime.state.messages)) {
      const source = messages.find(item => item.clientMsgID === info.clientMsgID)
      if (source)
        runtime.addMessages(id, [{ ...source, contentType: 2101,
          notificationElem: { detail: JSON.stringify(info) } }])
    }
    void messaging.refresh().catch(error => {
      if (epoch === runtime.generation)
        runtime.reportError(error)
    })
  })
  on('onRecvC2CReadReceipt', data => {
    const receipts = Array.isArray(data) ? data as Array<{
      userID?: string
      groupID?: string
      msgIDList?: string[]
      sessionType?: number
    }> : []
    for (const receipt of receipts) {
      if (!receipt.userID || receipt.groupID || receipt.sessionType !== 1 || !Array.isArray(receipt.msgIDList))
        continue
      const conversation = runtime.state.conversations.find(item => !item.groupID && item.userID === receipt.userID)
      if (!conversation)
        continue
      const ids = new Set(receipt.msgIDList)
      const messages = (runtime.state.messages[conversation.conversationID] || [])
        .filter(message => ids.has(message.clientMsgID) && message.sendID === runtime.state.session?.userID &&
          message.recvID === receipt.userID && !message.groupID && message.status === 2 && !message.isRead)
      if (messages.length)
        runtime.addMessages(conversation.conversationID, messages.map(message => ({ ...message, isRead: true })))
    }
  })
  on('onRecvGroupReadReceipt', data => {
    const receipt = data as {
      conversationID?: string
      groupMessageReadInfo?: Array<{
        clientMsgID?: string
        hasReadCount?: number
        unreadCount?: number
      }>
    }
    if (!receipt?.conversationID || !Array.isArray(receipt.groupMessageReadInfo))
      return
    for (const item of receipt.groupMessageReadInfo)
      if (item.clientMsgID && Number.isSafeInteger(item.hasReadCount) && Number.isSafeInteger(item.unreadCount) && (item.hasReadCount || 0) >= 0 && (item.unreadCount || 0) >= 0)
        runtime.syncMessageReaders(receipt.conversationID, item.clientMsgID, item.hasReadCount!, item.unreadCount!)
    const conversation = runtime.state.conversations.find(item => item.conversationID === receipt.conversationID && !!item.groupID)
    if (!conversation)
      return
    const allReadIDs = new Set(receipt.groupMessageReadInfo
      .filter(item => item.clientMsgID && item.hasReadCount && item.unreadCount === 0)
      .map(item => item.clientMsgID!))
    if (!allReadIDs.size)
      return
    const messages = (runtime.state.messages[conversation.conversationID] || [])
      .filter(message => allReadIDs.has(message.clientMsgID) && message.sendID === runtime.state.session?.userID &&
        message.groupID === conversation.groupID && message.status === 2 && !message.isRead)
    if (messages.length)
      runtime.addMessages(conversation.conversationID, messages.map(message => ({ ...message, isRead: true })))
  })
  // The chat server's online-only notice that a group member's read position moved past
  // messages this user sent (chat: internal/api/chat/group_read_webhook.go). OpenIM itself pushes
  // nothing to the sender when a member reads.
  on('onRecvCustomBusinessMessage', data => {
    const notice = groupReadNotice(data)
    const known = !!notice && runtime.state.conversations.some(item => item.conversationID === notice.conversationID && !!item.groupID)
    // Diagnostics only (EXPO_PUBLIC_OPENIM_ENTRY_TRACE): shows whether a pushed read notice reaches JS.
    if (process.env.EXPO_PUBLIC_OPENIM_ENTRY_TRACE === '1')
      console.info('[IMReadPush]', JSON.stringify({ shape: typeof data, conversationID: notice?.conversationID, known }))
    if (notice && known)
      runtime.readersChanged(notice.conversationID)
  })
  on('onRecvNewMessage', receive)
  on('onRecvNewMessages', receive)
  on('onRecvOfflineNewMessage', receive)
  on('onRecvOfflineNewMessages', receive)
  return () => disposers.forEach(dispose => dispose())
}
