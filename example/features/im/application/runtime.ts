import { mergeMessages, routeMessages } from '../domain/model'
import type { Conversation, IMMessage, ServerConfig, Session } from '../domain/types'
import { errorMessage } from '../shared/error-message'

interface State {
  initialized: boolean
  session?: Session
  config: ServerConfig
  status: string
  busy: boolean
  error: string
  recoveryAvailable: boolean
  conversations: Conversation[]
  messages: Record<string, IMMessage[]>
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
    conversations: [],
    messages: {},
    historyEnd: {},
  }
  const listeners = new Set<() => void>()

  function update (patch: Partial<State>) {
    state = { ...state, ...patch }
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
  function addMessages (id: string, incoming: IMMessage[]) {
    update({
      messages: { ...state.messages, [id]: mergeMessages(state.messages[id] || [], incoming) },
    })
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
