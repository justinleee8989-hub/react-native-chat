import { mergeMessages, routeMessages } from '../domain/model'
import type { Conversation, GroupMessageReadGuard, GroupMessageReadInfo, IMMessage, ServerConfig, Session } from '../domain/types'
import type { HomeSnapshot } from '../infrastructure/storage/home-snapshot'
import { errorMessage } from '../shared/error-message'
import { trimMessageCache } from './message-cache'

interface State {
  startupSnapshot?: HomeSnapshot
  initialized: boolean
  session?: Session
  config: ServerConfig
  status: string
  busy: boolean
  error: string
  recoveryAvailable: boolean
  conversationsLoaded?: boolean
  conversations: Conversation[]
  messages: Record<string, IMMessage[]>
  messageReadInfo: Record<string, Record<string, GroupMessageReadInfo>>
  historyLoading?: Record<string, boolean>
  historyPaging?: Record<string, boolean>
  historyEnd: Record<string, boolean>
}

export function createRuntime (config: ServerConfig) {
  let state: State = {
    initialized: false,
    config,
    status: '未登录',
    busy: false,
    error: '',
    recoveryAvailable: false,
    conversationsLoaded: false,
    conversations: [],
    messages: {},
    messageReadInfo: {},
    historyEnd: {},
    historyLoading: {},
    historyPaging: {},
  }
  const listeners = new Set<() => void>()
  const accesses = new Map<string, true>()

  function update (patch: Partial<State>) {
    if (patch.messages && !Object.keys(patch.messages).length)
      accesses.clear()
    const resetReadInfo = !!patch.messages && Object.keys(patch.messages).length === 0
    state = { ...state, ...patch, messageReadInfo: patch.messageReadInfo ?? (resetReadInfo ? {} : state.messageReadInfo) }
    listeners.forEach(listener => listener())
  }
  function reportError (error: unknown) {
    update({ error: errorMessage(error) })
  }
  function mergeConversations (incoming: Conversation[]) {
    const map = new Map(state.conversations.map(item => [item.conversationID, item]))
    incoming.forEach(item => map.set(item.conversationID, item))
    update({ conversations: [...map.values()] })
    drainMessages()
  }
  function touchMessageCache (id: string) {
    accesses.delete(id)
    accesses.set(id, true)
  }
  function boundMessages (source = state.messages) {
    for (const id of accesses.keys())
      if (!source[id])
        accesses.delete(id)
    const result = trimMessageCache(source, runtime.activeID, [...accesses.keys()], Object.keys(state.historyLoading || {}).filter(id => state.historyLoading?.[id]))
    if (!result.truncated.length)
      return { messages: result.messages }
    const historyEnd = { ...state.historyEnd }
    const messageReadInfo = { ...state.messageReadInfo }
    for (const id of result.truncated) {
      historyEnd[id] = false
      delete messageReadInfo[id]
      if (!result.messages[id])
        accesses.delete(id)
    }
    return { messages: result.messages, historyEnd, messageReadInfo }
  }
  function pruneMessageCache () {
    const patch = boundMessages()
    if (patch.messages !== state.messages)
      update(patch)
  }
  function addMessages (id: string, incoming: IMMessage[]) {
    touchMessageCache(id)
    update(boundMessages({ ...state.messages, [id]: mergeMessages(state.messages[id] || [], incoming) }))
  }
  function syncMessageReaders (conversationID: string, messageID: string, readCount: number, unreadCount: number, guard?: GroupMessageReadGuard) {
    if (!Number.isSafeInteger(readCount) || readCount < 0 || !Number.isSafeInteger(unreadCount) || unreadCount < 0)
      return
    if (guard && (state.messageReadInfo[conversationID]?.[messageID] !== guard.readInfo || state.session?.userID !== guard.userID || state.session?.imToken !== guard.imToken || state.session?.chatToken !== guard.chatToken))
      return
    const conversation = state.conversations.find(item => item.conversationID === conversationID && !!item.groupID)
    const message = state.messages[conversationID]?.find(item => item.clientMsgID === messageID)
    if (!conversation?.groupID || !message || message.groupID !== conversation.groupID || message.sendID !== state.session?.userID || message.status !== 2)
      return
    // Unchanged counts leave the store alone: the chat page polls them while someone has not read
    // the latest message, and every store update re-renders the screens that read it.
    const existing = state.messageReadInfo[conversationID]?.[messageID]
    if (existing && existing.readCount === readCount && existing.unreadCount === unreadCount)
      return
    const messageReadInfo = {
      ...state.messageReadInfo,
      [conversationID]: { ...state.messageReadInfo[conversationID], [messageID]: { readCount, unreadCount } },
    }
    update({ messageReadInfo })
  }
  function clearMessageReadInfo (conversationID: string) {
    if (!state.messageReadInfo[conversationID])
      return
    const messageReadInfo = { ...state.messageReadInfo }
    delete messageReadInfo[conversationID]
    update({ messageReadInfo })
  }
  function drainMessages () {
    const routed = routeMessages(
      runtime.pendingMessages,
      state.conversations,
      state.session?.userID || ''
    )
    runtime.pendingMessages = routed.remaining
    for (const [id, messages] of Object.entries(routed.byConversation))
      addMessages(id, messages)
  }

  const runtime = {
    get state() {
      return state
    },
    generation: 0,
    activeID: '',
    historyRevision: {} as Record<string, number>,
    pendingMessages: [] as IMMessage[],
    update,
    reportError,
    mergeConversations,
    addMessages,
    touchMessageCache,
    pruneMessageCache,
    syncMessageReaders,
    clearMessageReadInfo,
    drainMessages,
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    snapshot: () => state,
  }
  return runtime
}
export type Runtime = ReturnType<typeof createRuntime>
