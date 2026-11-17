/** `{ conversationID }` from a `group_read_progress` business message, whatever shape the SDK hands it in. */
export function groupReadNotice (data: unknown): { conversationID: string } | undefined {
  try {
    const message = (typeof data === 'string' ? JSON.parse(data) : data) as { key?: unknown, data?: unknown } | null
    if (!message || message.key !== 'group_read_progress')
      return undefined
    const notice = (typeof message.data === 'string' ? JSON.parse(message.data) : message.data) as { conversationID?: unknown } | null
    return typeof notice?.conversationID === 'string' && notice.conversationID.startsWith('sg_')
      ? { conversationID: notice.conversationID }
      : undefined
  } catch {
    return undefined
  }
}
