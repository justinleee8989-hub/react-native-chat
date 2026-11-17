import type { IMessage } from '@kesha-antonov/react-native-chat'
import type { Session } from '../domain/types'
export interface MessageExtra {
  text?: string
  editedAt?: number
  reactions?: Record<string, Record<string, boolean>>
  revision: number
}
export function batchMessageIDs (ids: string[], batchSize = 100) {
  const size = Math.max(1, Math.floor(batchSize))
  const batches: string[][] = []
  for (let index = 0; index < ids.length; index += size)
    batches.push(ids.slice(index, index + size))
  return batches
}
/**
 * `current` itself when `incoming` changes nothing: the chat page polls every few seconds, and a
 * new object each time re-projected and re-checked every message on screen.
 */
export function mergeMessageExtras (current: Record<string, MessageExtra>, incoming: Record<string, MessageExtra>) {
  let next: Record<string, MessageExtra> | undefined
  for (const [id, value] of Object.entries(incoming)) {
    const existing = current[id]
    if (existing && (existing.revision > value.revision || (existing.revision === value.revision && JSON.stringify(existing) === JSON.stringify(value))))
      continue
    next = next || { ...current }
    next[id] = value
  }
  return next || current
}
export function applyExtras (message: IMessage, extra?: MessageExtra): IMessage {
  if (!extra || message.system)
    return message
  return { ...message, text: extra.text ?? message.text, isEdited: !!extra.editedAt, editedAt: extra.editedAt,
    reactions: Object.entries(extra.reactions || {}).map(([emoji, actors]) => ({ emoji, userIds: Object.keys(actors).filter(id => actors[id]) })) }
}
export async function messageExtras (session: Session, url: string, request: Record<string, unknown>) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 10000)
  try {
    const response = await fetch(`${url.replace(/\/$/, '')}/user/message/extras`, { method: 'POST', signal: controller.signal,
      headers: { 'Content-Type': 'application/json', token: session.chatToken || '', operationID: `message-${Date.now()}` }, body: JSON.stringify(request) })
    const result = await response.json()
    if (!response.ok || result.errCode)
      throw new Error(result.errMsg || '消息增强服务不可用')
    return (result.data?.records || {}) as Record<string, MessageExtra>
  } finally {
    clearTimeout(timer)
  }
}

/** Resolve freshly sent SDK messages against authenticated history, never guess a sequence. */
export async function resolveExtraSequence (
  message: { clientMsgID: string, seq?: number },
  loadPage: (cursor: string) => Promise<{ messages: { clientMsgID: string, seq?: number }[], hasMore: boolean, cursor: string }>
) {
  if (Number.isSafeInteger(message.seq) && (message.seq || 0) > 0)
    return message.seq!
  let cursor = ''
  const visited = new Set<string>([''])
  while (true) {
    const page = await loadPage(cursor)
    const found = page.messages.find(item => item.clientMsgID === message.clientMsgID)
    if (found) {
      if (Number.isSafeInteger(found.seq) && (found.seq || 0) > 0)
        return found.seq!
      throw new Error('消息尚未同步，请稍后重试')
    }
    if (!page.hasMore)
      throw new Error('消息尚未同步或已不可访问，请稍后重试')
    if (!page.cursor || visited.has(page.cursor))
      throw new Error('历史分页未前进，请重试')
    visited.add(page.cursor)
    cursor = page.cursor
  }
}
