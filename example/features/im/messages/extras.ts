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
export function mergeMessageExtras (current: Record<string, MessageExtra>, incoming: Record<string, MessageExtra>) {
  const next = { ...current }
  for (const [id, value] of Object.entries(incoming))
    if (!next[id] || next[id].revision <= value.revision)
      next[id] = value
  return next
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
