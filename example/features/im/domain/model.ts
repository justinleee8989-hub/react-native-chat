import type { IMessage, ChatListItem } from '@kesha-antonov/react-native-chat'
import { signalSummary } from '../calls/signaling.ts'
import type { MessageKey, Translate } from '../i18n/translate.ts'
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
const notices: Record<number, MessageKey> = {
  1201: 'notice.friendAdded', 1501: 'notice.groupCreated', 1502: 'notice.groupInfoUpdated',
  1504: 'notice.memberQuit', 1507: 'notice.ownerTransferred', 1508: 'notice.memberKicked',
  1509: 'notice.membersInvited', 1510: 'notice.memberJoined', 1511: 'notice.groupDismissed',
  1512: 'notice.memberMuted', 1513: 'notice.memberUnmuted', 1514: 'notice.groupMuted',
  1515: 'notice.groupUnmuted', 1519: 'notice.announcementUpdated', 1520: 'notice.groupNameUpdated',
  1701: 'notice.burnAfterReading',
}

/** The chat library's view of a message; every word it adds (notices, previews) is in `tr`'s language. */
export function toMessage (message: IMMessage, tr: Translate): IMessage {
  const key = notices[message.contentType]
  let notice = key ? tr(key) : undefined
  if (message.contentType === 2101) {
    let detail: { revokerNickname?: string, revokedBySelf?: boolean } = {}
    try {
      detail = JSON.parse(message.notificationElem?.detail || '{}')
    } catch { /* Old SDK records may have no structured revocation detail. */ }
    notice = detail.revokedBySelf
      ? tr('notice.revokedBySelf')
      : tr('notice.revoked', { name: detail.revokerNickname || tr('notice.someone') })
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
      quoteElem: undefined, ex: undefined }, tr) : undefined,
    text:
      message.contentType === 106
        ? (message.atTextElem?.text ?? '')
        : message.contentType === 114
          ? (message.quoteElem?.text ?? '')
          : message.contentType === 101
            ? signalSummary(message.textElem?.content ?? '', tr)
            : message.contentType === 108
              ? tr('preview.card', { name: message.cardElem?.nickname || message.cardElem?.userID || '' })
              : message.contentType === 109
                ? tr('preview.location', { name: message.locationElem?.description || '' })
                : [102, 103, 104, 105].includes(message.contentType)
                  ? ''
                  : tr('preview.unsupported'),
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
        name: message.fileElem.fileName || tr('file.defaultName'),
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
export function toChat (conversation: Conversation, tr: Translate, userID?: string): ChatListItem & { avatarID: string } {
  let lastMessage: IMessage | undefined
  try {
    if (conversation.latestMsg)
      lastMessage = toMessage(JSON.parse(conversation.latestMsg), tr)
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
