import type { Conversation } from '../domain/types'
import type { ConversationService } from '../infrastructure/openim/conversation-service'
import type { Runtime } from './runtime'

export function createConversationActions (runtime: Runtime, service: ConversationService, flushSnapshot: () => Promise<void> = async () => {}) {
  const pending = new Set<string>()
  async function apply<T> (ids: string[], operation: string, remote: (id: string) => Promise<T>, local: (id: string, result: T) => void) {
    if (!runtime.state.session)
      throw new Error('请先登录')
    const epoch = runtime.generation
    for (const id of [...new Set(ids)]) {
      if (epoch !== runtime.generation)
        return
      if (!runtime.state.conversations.some(item => item.conversationID === id))
        continue
      const key = `${epoch}:${operation}:${id}`
      if (pending.has(key))
        continue
      pending.add(key)
      try {
        const result = await remote(id)
        if (epoch === runtime.generation)
          local(id, result)
      } finally {
        pending.delete(key)
      }
    }
  }
  function patch (id: string, value: Partial<Conversation>) {
    runtime.update({ conversations: runtime.state.conversations.map(item => item.conversationID === id ? { ...item, ...value } : item) })
  }
  function clearLocal (id: string, remove: boolean) {
    runtime.historyRevision ??= {}
    runtime.historyRevision[id] = (runtime.historyRevision[id] || 0) + 1
    const messages = { ...runtime.state.messages }
    const historyEnd = { ...runtime.state.historyEnd }
    const historyLoading = { ...runtime.state.historyLoading }
    const historyPaging = { ...runtime.state.historyPaging }
    delete messages[id]
    delete historyEnd[id]
    delete historyLoading[id]
    delete historyPaging[id]
    runtime.clearMessageReadInfo(id)
    const conversations = remove
      ? runtime.state.conversations.filter(item => item.conversationID !== id)
      : runtime.state.conversations.map(item => item.conversationID === id ? { ...item, latestMsg: '', unreadCount: 0 } : item)
    if (remove && runtime.activeID === id)
      runtime.activeID = ''
    runtime.update({ messages, historyEnd, historyLoading, historyPaging, conversations })
  }
  async function changeHistory (ids: string[], remove: boolean) {
    const epoch = runtime.generation
    try {
      await apply(ids, remove ? 'remove' : 'clear', remove ? service.remove : service.clear, id => clearLocal(id, remove))
    } finally {
      // Also flush partial batches and retries whose IDs have already left memory.
      // The bound writer captures this account before any asynchronous storage work.
      if (epoch === runtime.generation && runtime.state.session)
        await flushSnapshot()
    }
  }
  return {
    setPinned: (ids: string[], pinned: boolean) => apply(ids, 'pin', id => service.pin(id, pinned), id => patch(id, { isPinned: pinned })),
    setMuted: (ids: string[], muted: boolean) => apply(ids, 'mute', id => service.mute(id, muted), id => patch(id, { recvMsgOpt: muted ? 2 : 0 })),
    setArchived: (ids: string[], archived: boolean) => {
      const userID = runtime.state.session?.userID
      if (!userID)
        throw new Error('请先登录')
      return apply(ids, 'archive', id => {
        const conversation = runtime.state.conversations.find(item => item.conversationID === id)
        if (!conversation)
          throw new Error('会话不存在，请刷新后重试')
        return service.archive(id, conversation.ex, userID, archived, conversation.conversationType, conversation.groupID || conversation.userID || id)
      }, (id, ex) => patch(id, { ex, ...(archived ? { isPinned: false } : {}) }))
    },
    clearConversation: (id: string) => changeHistory([id], false),
    removeConversations: (ids: string[]) => changeHistory(ids, true),
  }
}
