export interface ConversationRecoveryContext {
  conversationID: string
  generation: number
  session: { userID: string, imToken: string, chatToken?: string }
}

export function createConversationRecovery ({
  isCurrent,
  refresh,
  loadHistory,
}: {
  isCurrent: (context: ConversationRecoveryContext) => boolean
  refresh: () => Promise<unknown>
  loadHistory: (conversationID: string) => Promise<unknown>
}) {
  const pending = new Map<string, Promise<void>>()
  return async (context: ConversationRecoveryContext) => {
    if (!isCurrent(context))
      return
    const key = JSON.stringify([
      context.generation,
      context.session.userID,
      context.session.imToken,
      context.session.chatToken || '',
      context.conversationID,
    ])
    const existing = pending.get(key)
    if (existing)
      return existing
    const request = (async () => {
      await refresh()
      if (isCurrent(context))
        await loadHistory(context.conversationID)
    })().finally(() => {
      if (pending.get(key) === request)
        pending.delete(key)
    })
    pending.set(key, request)
    return request
  }
}
