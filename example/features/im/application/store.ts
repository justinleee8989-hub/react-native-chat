import { useEffect, useSyncExternalStore } from 'react'
import { authenticate } from '../auth/api'
import { isInvalidSDKLoginError } from '../auth/sdk-login-error'
import { callAuthority } from '../calls/authority-api'
import { assertJoinableInvitation, parseCallInvitation } from '../calls/invitation.ts'
import { createServerCallController } from '../calls/server-controller'
import { encodeSignal } from '../calls/signaling'
import { defaultConfig, platformID } from '../config'
import type { ServerConfig, Session } from '../domain/types'
import { client } from '../infrastructure/openim/client'
import { conversationService } from '../infrastructure/openim/conversation-client'
import { storage } from '../infrastructure/storage/storage'
import { createMessageProjectionService } from '../messages/projection'
import { createConversationActions } from './conversation-actions'
import { subscribeEvents } from './events'
import { createMessaging } from './messaging'
import { createRuntime } from './runtime'

const key = 'openim-example-session-v1'
const runtime = createRuntime(defaultConfig)
const messaging = createMessaging(runtime, client, async message => {
  const invite = parseCallInvitation(message.textElem?.content || '')
  if (!invite)
    return
  const { session, config } = runtime.state
  if (!session)
    throw new Error('请先登录')
  const calls = await callAuthority(session, config.chat, { action: 'inspect', room: invite.room })
  assertJoinableInvitation(calls[0])
}, {
  async load (conversationID, messageIDs) {
    const { session, config } = runtime.state
    if (!session)
      throw new Error('请先登录')
    const epoch = runtime.generation
    const records = await createMessageProjectionService(session, config.chat).load(conversationID, messageIDs)
    if (epoch !== runtime.generation)
      throw new Error('登录已改变，请重新加载消息')
    return records
  },
})
export const { setPinned, setMuted, setArchived, clearConversation, removeConversations } = createConversationActions(runtime, conversationService)
let disposeEvents = () => {}
let restored = false
export const calls = createServerCallController({ request: async request => {
  const epoch = runtime.generation
  const { session, config } = runtime.state
  if (!session) 
    throw new Error('请先登录')
  const result = await callAuthority(session, config.chat, request)
  if (epoch !== runtime.generation) 
    throw new Error('登录已改变')
  return result
}, record: async (peer, signal) => {
  const epoch = runtime.generation
  if (!runtime.state.session)
    throw new Error('请先登录')
  const conversation = await client.conversation(peer, 1)
  const message = await client.createText(encodeSignal(signal))
  if (epoch !== runtime.generation)
    throw new Error('登录已改变')
  const delivered = await client.send(message, conversation)
  if (epoch !== runtime.generation)
    return
  runtime.mergeConversations([conversation])
  runtime.addMessages(conversation.conversationID, [delivered])
  void messaging.refresh().catch(error => {
    if (epoch === runtime.generation)
      runtime.reportError(error)
  })
} })
export const { reportError } = runtime
export const {
  openConversation,
  loadHistory,
  focusConversation,
  sendText,
  sendTextChecked,
  sendPreparedChecked,
  sendMedia,
  sendAttachmentBatchChecked,
  retryMessage,
  sendQuote,
  forwardMessage,
  revokeMessage,
  searchMessages,
  ensureMessageLoaded,
} = messaging
export const {
  createAttachmentBatch,
  getAttachmentBatch,
  listAttachmentBatches,
  runAttachmentBatch,
  cancelAttachmentBatch,
  subscribeAttachmentBatches,
  getAttachmentBatchesSnapshot,
} = messaging

async function connect (session: Session, config: ServerConfig) {
  const epoch = ++runtime.generation
  disposeEvents()
  runtime.update({ busy: true, error: '', status: '连接中', config, recoveryAvailable: true })
  disposeEvents = subscribeEvents(client, runtime, { ...messaging, refresh }, logout, epoch, message => calls.receive(message))
  let sdkLoggedIn = false
  try {
    await client.login(session, config)
    if (epoch !== runtime.generation)
      return
    sdkLoggedIn = true
    calls.reset(session.userID)
    runtime.update({ session, status: '已连接' })
    const syncResult = await refresh()
    if (epoch === runtime.generation && syncResult?.projectionWarning)
      runtime.update({ error: syncResult.projectionWarning, recoveryAvailable: true })
  } catch (error) {
    if (epoch !== runtime.generation)
      return
    if (!sdkLoggedIn && isInvalidSDKLoginError(error)) {
      await logout('登录凭据已失效，请重新登录')
      return
    }
    if (sdkLoggedIn) {
      runtime.update({ busy: false, status: '同步暂时失败', recoveryAvailable: true,
        error: '已登录，但会话同步暂时失败。可下拉会话列表重试。' })
      return
    }
    const recoveryEpoch = ++runtime.generation
    disposeEvents()
    calls.reset('')
    runtime.activeID = ''
    runtime.pendingMessages = []
    messaging.reset()
    if (recoveryEpoch === runtime.generation)
      runtime.update({ session: undefined, busy: false, status: '连接暂时失败', recoveryAvailable: true,
        error: '暂时无法连接服务，登录信息已保留，可重试恢复登录。' })
    return
  }
  if (epoch === runtime.generation)
    runtime.update({ busy: false })
}
export async function refresh () {
  const epoch = runtime.generation
  const session = runtime.state.session
  try {
    const result = await messaging.refresh()
    if (epoch !== runtime.generation || session !== runtime.state.session)
      return
    const projectionWarning = result?.projectionWarning
    if (session)
      runtime.update({ status: '已连接', error: projectionWarning || '', recoveryAvailable: !!projectionWarning })
    return projectionWarning ? { projectionWarning } : undefined
  } catch (error) {
    if (epoch !== runtime.generation || session !== runtime.state.session)
      return
    if (session)
      runtime.update({ status: '同步暂时失败', error: '会话同步暂时失败，可下拉会话列表重试。', recoveryAvailable: true })
    throw error
  }
}
export async function login (account: string, password: string, config: ServerConfig) {
  if (runtime.state.busy)
    return
  const epoch = ++runtime.generation
  runtime.update({ busy: true, error: '' })
  try {
    const session = await authenticate(account, password, config.chat, platformID)
    if (epoch === runtime.generation) {
      await storage.setItem(key, JSON.stringify({ session, config }))
      if (epoch !== runtime.generation)
        return
      await connect(session, config)
    }
  } catch (error) {
    if (epoch === runtime.generation)
      reportError(error)
  }
  if (epoch === runtime.generation)
    runtime.update({ busy: false })
}
async function restore (retry = false) {
  if ((!retry && restored) || runtime.state.busy)
    return
  if (!retry)
    restored = true
  const epoch = runtime.generation
  runtime.update({ busy: true, error: '' })
  try {
    const saved = await storage.getItem(key)
    if (epoch !== runtime.generation)
      return
    if (saved) {
      const { session, config } = JSON.parse(saved)
      runtime.update({ config, recoveryAvailable: true })
      await connect(session, config)
      return
    }
    runtime.update({ busy: false, recoveryAvailable: false })
  } catch {
    if (epoch === runtime.generation)
      runtime.update({ busy: false, status: '恢复失败', recoveryAvailable: true,
        error: '读取已保存的登录信息失败，原数据已保留，可重试恢复登录。' })
  } finally {
    runtime.update({ initialized: true })
  }
}
export async function retryRestore () {
  if (runtime.state.busy)
    return
  if (runtime.state.session) {
    const epoch = runtime.generation
    runtime.update({ busy: true, error: '' })
    try {
      await refresh()
    } catch { /* refresh preserves a retryable status and the current SDK session. */ } finally {
      if (epoch === runtime.generation)
        runtime.update({ busy: false })
    }
    return
  }
  await restore(true)
}
export async function logout (error = '') {
  void calls.finish('end').catch(() => {})
  calls.reset('')
  const epoch = ++runtime.generation
  disposeEvents()
  runtime.activeID = ''
  runtime.pendingMessages = []
  messaging.reset()
  runtime.update({
    session: undefined,
    busy: true,
    status: '未登录',
    error,
    recoveryAvailable: false,
    conversations: [],
    messages: {},
    historyEnd: {},
  })
  try {
    await storage.removeItem(key)
  } catch {
    /* SDK logout still runs when local storage is unavailable. */
  }
  try {
    await client.logout()
  } catch {
    /* Local logout must work even when the server is unreachable. */
  }
  if (epoch === runtime.generation)
    runtime.update({ busy: false })
}
export function useOpenIM () {
  useEffect(() => {
    void restore()
  }, [])
  return useSyncExternalStore(runtime.subscribe, runtime.snapshot, runtime.snapshot)
}
