import type { IMessage, ChatListItem } from '@kesha-antonov/react-native-chat'
import { signalSummary } from '../calls/signaling.ts'
import { readReply } from '../messages/composer.ts'
import { applyExtras } from '../messages/extras.ts'
import { isConversationArchived } from './conversation-archive.ts'
import type { Conversation, IMMessage } from './types'

export function mergeMessages (current: IMMessage[], incoming: IMMessage[]): IMMessage[] {
  const byID = new Map(current.map(message => [message.clientMsgID, message]))
  for (const message of incoming)
    if (message.clientMsgID)
      byID.set(message.clientMsgID, { ...byID.get(message.clientMsgID), ...message })
  return [...byID.values()].sort(
    (a, b) => b.sendTime - a.sendTime || b.clientMsgID.localeCompare(a.clientMsgID)
  )
}
export function belongsToConversation (
  message: IMMessage,
  conversation: Conversation,
  self: string
) {
  if (conversation.groupID)
    return message.groupID === conversation.groupID
  return (
    !message.groupID &&
    (message.sendID === conversation.userID ||
      (message.sendID === self && message.recvID === conversation.userID))
  )
}
export function toMessage (message: IMMessage): IMessage {
  const notices: Record<number, string> = {
    1201: '已添加为好友', 1501: '群聊已创建', 1502: '群资料已更新',
    1504: '有成员退出群聊', 1507: '群主已转让', 1508: '有成员被移出群聊',
    1509: '已邀请新成员', 1510: '有新成员加入群聊', 1511: '群聊已解散',
    1512: '群成员已被禁言', 1513: '群成员已解除禁言', 1514: '已开启全员禁言',
    1515: '已关闭全员禁言', 1519: '群公告已更新', 1520: '群名称已更新',
    1701: '阅后即焚设置已更新',
  }
  let notice = notices[message.contentType]
  if (message.contentType === 2101) {
    let name = '对方'
    try {
      name = JSON.parse(message.notificationElem?.detail || '{}').revokerNickname || '对方'
    } catch { /* Old SDK records may have no structured revocation detail. */ }
    notice = `${name} 撤回了一条消息`
  }
  if (notice)
    return { _id: message.clientMsgID, text: notice, system: true,
      createdAt: new Date(message.sendTime || message.createTime || Date.now()), user: { _id: 'system' } }
  const quoted = message.quoteElem?.quoteMessage || readReply(message)
  const imageDimensions = { imageWidth: message.pictureElem?.sourcePicture?.width, imageHeight: message.pictureElem?.sourcePicture?.height }
  return applyExtras({
    ...imageDimensions,
    _id: message.clientMsgID,
    replyMessage: quoted ? toMessage({ ...quoted,
      ...(quoted.contentType === 114 ? { contentType: 101, textElem: { content: quoted.quoteElem?.text || '' } } : {}),
      quoteElem: undefined, ex: undefined }) : undefined,
    text:
      message.contentType === 106
        ? (message.atTextElem?.text ?? '')
        : message.contentType === 114
          ? (message.quoteElem?.text ?? '')
          : message.contentType === 101
            ? signalSummary(message.textElem?.content ?? '')
            : message.contentType === 108
              ? `[名片] ${message.cardElem?.nickname || message.cardElem?.userID || ''}`
              : message.contentType === 109
                ? `[位置] ${message.locationElem?.description || ''}`
                : [102, 103, 104, 105].includes(message.contentType)
                  ? ''
                  : '[暂不支持的消息类型]',
    createdAt: new Date(message.sendTime || message.createTime || Date.now()),
    user: {
      _id: message.sendID || 'unknown',
      name: message.senderNickname || message.sendID,
      avatar: message.senderFaceUrl,
    },
    image: message.pictureElem?.sourcePicture?.url || message.pictureElem?.sourcePath,
    imagePlaceholder: message.pictureElem?.snapshotPicture?.url,
    audio: message.soundElem?.sourceUrl || message.soundElem?.soundPath,
    video: message.videoElem?.videoUrl || message.videoElem?.videoPath,
    duration: message.soundElem?.duration ?? message.videoElem?.duration,
    file: message.fileElem
      ? {
        uri: message.fileElem.sourceUrl || message.fileElem.filePath || '',
        name: message.fileElem.fileName || '文件',
        size: message.fileElem.fileSize,
      }
      : undefined,
    isFailed: message.status === 3,
    transfer:
      message.status === 1 && [102, 103, 104, 105].includes(message.contentType)
        ? {
          type: 'upload',
          progress:
              message.uploadProgress === undefined ? undefined : message.uploadProgress / 100,
        }
        : undefined,
    pending: message.status === 1,
    sent: message.status === 2,
    received: message.status === 2 && !!message.isRead,
  }, message.projection)
}
export function toChat (conversation: Conversation, userID?: string): ChatListItem & { avatarID: string } {
  let lastMessage: IMessage | undefined
  try {
    if (conversation.latestMsg)
      lastMessage = toMessage(JSON.parse(conversation.latestMsg))
  } catch {
    /* An invalid preview must not hide the conversation. */
  }
  return {
    id: conversation.conversationID,
    avatarID: conversation.groupID || conversation.userID || conversation.conversationID,
    title: conversation.showName || conversation.userID || conversation.groupID || 'Chat',
    kind: conversation.groupID ? 'group' : 'private',
    avatar: conversation.faceURL,
    unreadCount: conversation.unreadCount,
    draft: conversation.draftText,
    isPinned: conversation.isPinned,
    isMuted: conversation.recvMsgOpt === 2,
    isArchived: userID ? isConversationArchived(conversation.ex, userID) : undefined,
    lastMessage,
  }
}

export function routeMessages (messages: IMMessage[], conversations: Conversation[], self: string) {
  const byConversation: Record<string, IMMessage[]> = {}
  const remaining: IMMessage[] = []
  for (const message of messages) {
    const conversation = conversations.find(item => belongsToConversation(message, item, self))
    if (!conversation) {
      remaining.push(message)
      continue
    }
    const id = conversation.conversationID
    byConversation[id] = [...(byConversation[id] || []), message]
  }
  return { byConversation, remaining }
}
