import type { IMMessage, Session } from '../domain/types'
import { batchMessageIDs, messageExtras } from './extras'
import type { MessageExtra } from './extras'

export interface MessageProjectionService {
  load: (conversationID: string, messageIDs: string[]) => Promise<Record<string, MessageExtra>>
}

export function createMessageProjectionService (session: Session, url: string): MessageProjectionService {
  return {
    async load (conversationID, messageIDs) {
      const records: Record<string, MessageExtra> = {}
      for (const batch of batchMessageIDs([...new Set(messageIDs.filter(Boolean))])) {
        if (!batch.length)
          continue
        const found = await messageExtras(session, url, { action: 'get', conversationID, messageIDs: batch })
        Object.assign(records, found)
      }
      return records
    },
  }
}

/** Attach display metadata on a copy; preserve the SDK message as the source of truth. */
export function projectMessage (message: IMMessage, extra?: MessageExtra, records: Record<string, MessageExtra> = {}): IMMessage {
  if (!extra || message.contentType >= 1000 || message.contentType === 2101)
    return { ...message, ...(message.quoteElem?.quoteMessage ? { quoteElem: {
      ...message.quoteElem,
      quoteMessage: projectQuotedSource(message.quoteElem.quoteMessage, records),
    } } : {}) }
  return { ...message, projection: {
    text: extra.text,
    editedAt: extra.editedAt,
    reactions: extra.reactions,
    revision: extra.revision,
  }, ...(message.quoteElem?.quoteMessage ? { quoteElem: {
    ...message.quoteElem,
    quoteMessage: projectQuotedSource(message.quoteElem.quoteMessage, records),
  } } : {}) }
}

function projectQuotedSource (message: IMMessage, records: Record<string, MessageExtra>): IMMessage {
  const extra = records[message.clientMsgID]
  if (!extra || message.contentType >= 1000 || message.contentType === 2101)
    return { ...message }
  return { ...message, projection: { text: extra.text, editedAt: extra.editedAt, reactions: extra.reactions, revision: extra.revision } }
}

/** Build an SDK-compatible source copy for quote/forward creation, without display-only fields. */
export function sdkMessageWithProjection (message: IMMessage, extra?: MessageExtra): IMMessage {
  const source = { ...message }
  delete source.projection
  const projected = extra || message.projection
  if (!projected?.text || source.contentType >= 1000 || source.contentType === 2101)
    return source
  if (source.contentType === 106 && source.atTextElem)
    return { ...source, atTextElem: { ...source.atTextElem, text: projected.text } }
  if (source.contentType === 114 && source.quoteElem)
    return { ...source, quoteElem: { ...source.quoteElem, text: projected.text } }
  if (source.textElem)
    return { ...source, textElem: { ...source.textElem, content: projected.text } }
  return source
}

export function searchableText (message: IMMessage) {
  if (message.projection?.text !== undefined)
    return message.projection.text
  if (message.contentType === 106)
    return message.atTextElem?.text || ''
  if (message.contentType === 114)
    return message.quoteElem?.text || ''
  return message.textElem?.content || ''
}
