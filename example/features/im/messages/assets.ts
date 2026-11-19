import type { IMMessage } from '../domain/types'
import { ProductError } from '../shared/product-error.ts'
import type { MessageExtra } from './extras'

export type ConversationAssetKind = 'image' | 'file' | 'link'
export interface ConversationAsset {
  id: string
  kind: ConversationAssetKind
  messageID: string
  sendTime: number
  uri?: string
  title: string
  senderName?: string
  size?: number
}
interface HistoryPage {
  messageList: IMMessage[]
  isEnd: boolean
}
interface AssetsPagerDependencies {
  history: (conversationID: string, cursor: string) => Promise<HistoryPage>
  project: (conversationID: string, messageIDs: string[]) => Promise<Record<string, MessageExtra>>
  isCurrent: () => boolean
}

export function safeExternalHttpURL (value?: string) {
  if (!value)
    return undefined
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : undefined
  } catch {
    return undefined
  }
}

function imageSource (message: IMMessage) {
  const value = message.pictureElem?.sourcePicture?.url || message.pictureElem?.sourcePath || message.pictureElem?.snapshotPicture?.url
  if (!value)
    return undefined
  if (safeExternalHttpURL(value) || value.startsWith('file://'))
    return value
  return value.startsWith('/') ? `file://${value}` : undefined
}

function messageText (message: IMMessage, extras: Record<string, MessageExtra>) {
  const edited = extras[message.clientMsgID]?.text ?? message.projection?.text
  if (edited !== undefined)
    return edited
  if (message.contentType === 106)
    return message.atTextElem?.text || ''
  if (message.contentType === 114)
    return message.quoteElem?.text || ''
  return message.textElem?.content || ''
}

function linksFrom (text: string) {
  const found = new Set<string>()
  for (const match of text.matchAll(/https?:\/\/[^\s<>"']+/gi)) {
    const url = safeExternalHttpURL(match[0].replace(/[.,!?;:)\]}]+$/g, ''))
    if (url)
      found.add(url)
  }
  return [...found]
}

export function extractAssets (
  messages: IMMessage[],
  extras: Record<string, MessageExtra> = {}
): ConversationAsset[] {
  const assets: ConversationAsset[] = []
  for (const message of messages) {
    if (message.status !== 2 || message.contentType >= 1000 || message.contentType === 2101)
      continue
    const senderName = message.senderNickname || message.sendID
    const id = message.clientMsgID
    const sendTime = message.sendTime || message.createTime || 0
    if (message.contentType === 102) {
      const uri = imageSource(message)
      if (uri)
        assets.push({ id: `image:${id}`, kind: 'image', messageID: id, sendTime, senderName, uri, title: '' })
    }
    if (message.contentType === 105 && message.fileElem)
      assets.push({
        id: `file:${id}`,
        kind: 'file',
        senderName,
        messageID: id,
        sendTime,
        uri: safeExternalHttpURL(message.fileElem.sourceUrl),
        title: message.fileElem.fileName || '',
        size: message.fileElem.fileSize,
      })
    if ([101, 106, 114].includes(message.contentType))
      for (const uri of linksFrom(messageText(message, extras)))
        assets.push({ id: `link:${id}:${uri}`, kind: 'link', messageID: id, sendTime, senderName, uri, title: uri })
  }
  return assets
}

export function createAssetsPager (dependencies: AssetsPagerDependencies) {
  let cursor = ''
  let done = false
  const seenMessageIDs = new Set<string>()
  const seenCursors = new Set<string>()
  return {
    async loadNext (conversationID: string): Promise<{ assets: ConversationAsset[], done: boolean }> {
      if (!dependencies.isCurrent())
        throw new ProductError('assets.pageChanged')
      if (done)
        return { assets: [], done: true }
      const requestedCursor = cursor
      const page = await dependencies.history(conversationID, requestedCursor)
      if (!dependencies.isCurrent())
        throw new ProductError('assets.pageChanged')
      const messages = page.messageList || []
      if (!messages.length) {
        if (!page.isEnd)
          throw new ProductError('assets.noLocalPage')
        done = true
        return { assets: [], done }
      }
      const ordered = [...messages].sort((left, right) =>
        (left.sendTime || left.createTime || 0) - (right.sendTime || right.createTime || 0) ||
        (left.seq || 0) - (right.seq || 0) || left.clientMsgID.localeCompare(right.clientMsgID)
      )
      const nextCursor = ordered[0]?.clientMsgID
      if (!page.isEnd && (!nextCursor || nextCursor === requestedCursor || seenCursors.has(nextCursor)))
        throw new ProductError('assets.cursorStuck')
      const unique = [...new Map(messages
        .filter(message => message.clientMsgID && !seenMessageIDs.has(message.clientMsgID))
        .map(message => [message.clientMsgID, message])).values()]
      const textIDs = unique
        .filter(message => message.status === 2 && message.contentType < 1000 && [101, 106, 114].includes(message.contentType))
        .map(message => message.clientMsgID)
      const extras = textIDs.length ? await dependencies.project(conversationID, textIDs) : {}
      if (!dependencies.isCurrent())
        throw new ProductError('assets.pageChanged')
      const assets = extractAssets(unique, extras)
      unique.forEach(message => seenMessageIDs.add(message.clientMsgID))
      if (page.isEnd) {
        done = true
      } else {
        cursor = nextCursor
        seenCursors.add(nextCursor)
      }
      return { assets, done }
    },
  }
}
