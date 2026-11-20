import { useEffect, useSyncExternalStore } from 'react'
import { authenticate } from '../auth/api'
import { isInvalidSDKLoginError } from '../auth/sdk-login-error'
import { callAuthority } from '../calls/authority-api'
import { assertJoinableInvitation, parseCallInvitation } from '../calls/invitation.ts'
import { createServerCallController } from '../calls/server-controller'
import { encodeSignal } from '../calls/signaling'
import { defaultConfig, platformID } from '../config'
import type { GroupMessageReadGuard, ServerConfig, Session } from '../domain/types'
import { isMessageKey, type MessageKey } from '../i18n/translate.ts'
import { client } from '../infrastructure/openim/client'
import { setDraftStorageScope } from '../infrastructure/openim/composer-storage'
import { conversationService } from '../infrastructure/openim/conversation-client'
import { attachmentOutbox } from '../infrastructure/storage/attachment-outbox'
import { createHomeSnapshots } from '../infrastructure/storage/home-snapshot'
import { storage } from '../infrastructure/storage/storage'
import { createMessageProjectionService } from '../messages/projection'
import { fetchServerHistory, type ServerHistoryRequest } from '../messages/server-history'
import { ProductError } from '../shared/product-error.ts'
import { offlineStatus, provideConnectionStatus } from './connection-status'
import { createConversationActions } from './conversation-actions'
import { subscribeEvents } from './events'
import { createConversationRecovery } from './foreground-recovery'
import { watchHomeSnapshot } from './home-persistence'
import { createMessaging } from './messaging'
import { createRuntime } from './runtime'

declare const module: { hot?: { data?: { snapshot?: ReturnType<ReturnType<typeof createRuntime>['snapshot']> }, dispose: (callback: () => void) => void } }

const key = 'openim-example-session-v1'
/**
 * Why this tab was signed out, kept until the login page shows it. On the web, signing out reloads
 * the page, and the message set in memory before the reload was gone by the time the page loaded.
 */
const signOutReasonKey = 'openim-example-signout-reason-v1'
/**
 * The account (email) last signed in with, kept through any sign-out so the login page is filled in
 * and only the password is asked. The saved login holds the user ID and tokens only.
 */
const lastAccountKey = 'openim-example-last-account-v1'
const homeSnapshots = createHomeSnapshots(storage)
// The saved account could not reach the IM server for a reason other than its credentials. The user
// stays in the app on the cached list and is told only that; the store connects again by itself,
// waiting 2s, then twice as long each time up to 30s. A pull, the chat list's periodic sync or
// 重新加载 tries at once.
let offline: { session: Session, config: ServerConfig } | undefined
let reconnectTimer: ReturnType<typeof setTimeout> | undefined
let reconnectDelay = 0
let reconnecting: Promise<void> | undefined
function stopReconnecting () {
  offline = undefined
  clearTimeout(reconnectTimer)
  reconnectTimer = undefined
  reconnectDelay = 0
}
function scheduleReconnect () {
  clearTimeout(reconnectTimer)
  reconnectDelay = Math.min(reconnectDelay ? reconnectDelay * 2 : 2000, 30000)
  reconnectTimer = setTimeout(() => {
    void reconnect()
  }, reconnectDelay)
}
function reconnect () {
  const target = offline
  if (!target)
    return Promise.resolve()
  if (!reconnecting)
    reconnecting = connect(target.session, target.config, true).finally(() => {
      reconnecting = undefined
    })
  return reconnecting
}
let stopHomeSnapshot = () => {}
let flushHomeSnapshot = async () => {}
const runtime = createRuntime(defaultConfig)
provideConnectionStatus({ subscribe: runtime.subscribe, status: () => runtime.snapshot().status })
if (typeof module !== 'undefined' && module.hot?.data?.snapshot) {
  runtime.update({ ...module.hot.data.snapshot, busy: false })
  const { offline: wasOffline, session, config } = module.hot.data.snapshot
  if (wasOffline && session) {
    offline = { session, config }
    scheduleReconnect()
  }
}
const messaging = createMessaging(runtime, client, async message => {
  const invite = parseCallInvitation(message.textElem?.content || '')
  if (!invite)
    return
  const { session, config } = runtime.state
  if (!session)
    throw new ProductError('session.signInFirst')
  const calls = await callAuthority(session, config.chat, { action: 'inspect', room: invite.room })
  assertJoinableInvitation(calls[0])
}, {
  async load (conversationID, messageIDs) {
    const { session, config } = runtime.state
    if (!session)
      throw new ProductError('session.signInFirst')
    const epoch = runtime.generation
    const records = await createMessageProjectionService(session, config.chat).load(conversationID, messageIDs)
    if (epoch !== runtime.generation)
      throw new ProductError('session.changedReloadMessages')
    return records
  },
}, attachmentOutbox, recheckAttachmentDelivery)
export const { setPinned, setMuted, setArchived, clearConversation, removeConversations } = createConversationActions(runtime, conversationService, () => flushHomeSnapshot())
let disposeEvents = () => {}
let restored = false
export const calls = createServerCallController({ request: async request => {
  const epoch = runtime.generation
  const { session, config } = runtime.state
  if (!session)
    throw new ProductError('session.signInFirst')
  const result = await callAuthority(session, config.chat, request)
  if (epoch !== runtime.generation)
    throw new ProductError('session.changed')
  return result
}, record: async (peer, signal) => {
  const epoch = runtime.generation
  if (!runtime.state.session)
    throw new ProductError('session.signInFirst')
  const conversation = await client.conversation(peer, 1)
  const message = await client.createText(encodeSignal(signal))
  if (epoch !== runtime.generation)
    throw new ProductError('session.changed')
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
  sendLocation,
  sendCard,
  sendTextChecked,
  sendPreparedChecked,
  sendMedia,
  sendAttachmentBatchChecked,
  retryMessage,
  sendQuote,
  forwardMessage,
  revokeMessage,
  searchMessages,
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

/** `quiet`: a reconnect while the user is already in the app, which keeps the offline status up. */
async function connect (session: Session, config: ServerConfig, quiet = false) {
  const epoch = ++runtime.generation
  stopHomeSnapshot()
  setDraftStorageScope(JSON.stringify([config.api, config.ws]))
  disposeEvents()
  runtime.update(quiet ? { config } : { busy: true, error: '', status: 'connecting', config })
  disposeEvents = subscribeEvents(client, runtime, { ...messaging, refresh }, logout, epoch, message => calls.receive(message), () => calls.recheck())
  let sdkLoggedIn = false
  try {
    await client.login(session, config)
    if (epoch !== runtime.generation)
      return
    sdkLoggedIn = true
    stopReconnecting()
    calls.reset(session.userID)
    runtime.update({ session, offline: false, status: 'fetching', initialized: true, startupSnapshot: undefined })
    stopHomeSnapshot()
    const homePersistence = watchHomeSnapshot(runtime, homeSnapshots, session.userID, config)
    stopHomeSnapshot = homePersistence.stop
    flushHomeSnapshot = homePersistence.flush
    let recoveryWarning: ProductError | undefined
    try {
      await messaging.restoreAttachmentBatches()
    } catch {
      recoveryWarning = new ProductError('sync.attachmentRestoreFailed')
    }
    if (epoch !== runtime.generation)
      return
    const syncResult = await refresh()
    const warning = [recoveryWarning, syncResult?.projectionWarning].filter(Boolean)
    if (epoch === runtime.generation && warning.length)
      runtime.update({ error: warning.length === 1 ? warning[0] : warning })
  } catch (error) {
    if (epoch !== runtime.generation)
      return
    if (!sdkLoggedIn && isInvalidSDKLoginError(error)) {
      await homeSnapshots.remove(session.userID, config)
      await logout('session.expired')
      return
    }
    if (sdkLoggedIn) {
      runtime.update({ busy: false, status: 'syncFailed', error: new ProductError('sync.signedInButFailed') })
      return
    }
    const recoveryEpoch = ++runtime.generation
    disposeEvents()
    calls.reset('')
    stopHomeSnapshot()
    runtime.activeID = ''
    runtime.pendingMessages = []
    messaging.reset()
    if (recoveryEpoch === runtime.generation) {
      // Not a credentials problem: open the app on what it has instead of the login page.
      offline = { session, config }
      runtime.update({ session, offline: true, initialized: true, busy: false, status: offlineStatus, error: '' })
      scheduleReconnect()
    }
    return
  }
  if (epoch === runtime.generation)
    runtime.update({ busy: false })
}
export async function refresh () {
  if (offline) {
    await reconnect()
    return undefined
  }
  const epoch = runtime.generation
  const session = runtime.state.session
  const initial = !runtime.state.conversationsLoaded && !runtime.state.conversations.length
  if (initial && session)
    runtime.update({ busy: true, error: '' })
  try {
    const result = await messaging.refresh()
    if (epoch !== runtime.generation || session !== runtime.state.session)
      return
    const projectionWarning = result?.projectionWarning
    // The SDK answers from its local database while the server is unreachable: a refresh that worked
    // says nothing about the connection, so it must not replace the failure with 已连接.
    if (session)
      runtime.update({ status: runtime.state.status === offlineStatus ? offlineStatus : 'connected', error: projectionWarning || '' })
    return projectionWarning ? { projectionWarning } : undefined
  } catch (error) {
    if (epoch !== runtime.generation || session !== runtime.state.session)
      return
    if (session)
      runtime.update({ status: 'syncFailed', error: new ProductError('sync.chatsFailed') })
    throw error
  } finally {
    if (initial && epoch === runtime.generation && session === runtime.state.session)
      runtime.update({ busy: false })
  }
}
const recoverConversation = createConversationRecovery({
  isCurrent: context => runtime.generation === context.generation && runtime.activeID === context.conversationID && runtime.state.session === context.session,
  refresh,
  loadHistory: messaging.loadHistory,
})
export function resumeConversation (conversationID: string, session: Session) {
  return recoverConversation({ conversationID, generation: runtime.generation, session })
}
/** Signs in to the servers the app was built for (`defaultConfig`); there is no choosing one. */
export async function login (account: string, password: string) {
  if (runtime.state.busy)
    return
  const config = defaultConfig
  stopReconnecting()
  const epoch = ++runtime.generation
  runtime.update({ busy: true, error: '', startupSnapshot: undefined, conversations: [], conversationsLoaded: false })
  try {
    const session = await authenticate(account, password, config.chat, platformID)
    if (epoch === runtime.generation) {
      runtime.update({ lastAccount: { account } })
      await storage.setItem(lastAccountKey, JSON.stringify({ account })).catch(() => {})
      await storage.setItem(key, JSON.stringify({ session, config }))
      await storage.removeItem(signOutReasonKey)
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
function loadLastAccount (raw: string | null) {
  if (!raw || runtime.state.lastAccount)
    return
  try {
    // Entries written before the server settings were removed also hold `config`; it is ignored.
    const value = JSON.parse(raw) as { account?: unknown }
    if (typeof value.account === 'string')
      runtime.update({ lastAccount: { account: value.account } })
  } catch {
    /* A damaged entry only means the login page starts empty. */
  }
}
async function restore (retry = false) {
  if ((!retry && restored) || runtime.state.busy)
    return
  if (!retry)
    restored = true
  const epoch = runtime.generation
  runtime.update({ busy: true, error: '' })
  // Not awaited: only the login page uses it, and it fills in whenever this arrives.
  void storage.getItem(lastAccountKey).then(loadLastAccount, () => {})
  try {
    // Read twice before giving up: a failed read is rarely the data, and there is no choice to offer.
    const saved = await storage.getItem(key).catch(() => storage.getItem(key))
    if (epoch !== runtime.generation)
      return
    if (saved) {
      // The built-in servers, not the ones saved with the login: a login saved while the login page
      // could still choose servers may name one this build no longer reaches, and there is no longer
      // a way to change it. A token from another server is refused here like any dead token, which
      // signs out to the login page with the account filled in.
      const { session } = JSON.parse(saved)
      const config = defaultConfig
      const startupSnapshot = await homeSnapshots.load(session.userID, config)
      if (epoch !== runtime.generation)
        return
      runtime.update({ config, startupSnapshot,
        conversations: startupSnapshot?.conversations || [], conversationsLoaded: !!startupSnapshot })
      await connect(session, config)
      return
    }
    // A lost reason must not turn into "could not read the saved login".
    const reason = await storage.getItem(signOutReasonKey).catch(() => null)
    if (reason)
      await storage.removeItem(signOutReasonKey).catch(() => {})
    if (epoch !== runtime.generation)
      return
    // The reason is saved as its text's key; anything else (an older build's wording) is dropped.
    runtime.update({ busy: false, ...(reason && isMessageKey(reason) ? { error: new ProductError(reason) } : {}) })
  } catch {
    if (epoch === runtime.generation)
      runtime.update({ busy: false, error: new ProductError('session.savedUnreadable') })
  } finally {
    runtime.update({ initialized: true })
  }
}
export async function retryRestore () {
  if (runtime.state.busy)
    return
  if (offline) {
    await reconnect()
    return
  }
  if (runtime.state.session) {
    const epoch = runtime.generation
    runtime.update({ busy: true, error: '' })
    try {
      await messaging.restoreAttachmentBatches()
      await refresh()
    } catch (error) {
      if (epoch === runtime.generation)
        runtime.update({ error: error || new ProductError('session.restoreFailed') })
      /* refresh preserves a retryable status and the current SDK session. */
    } finally {
      if (epoch === runtime.generation)
        runtime.update({ busy: false })
    }
    return
  }
  await restore(true)
}
/** `reason`: why the user is signed out, said on the login page (kept through a reload). */
export async function logout (reason?: MessageKey) {
  const error = reason ? new ProductError(reason) : ''
  const previousSession = runtime.state.session
  const previousConfig = runtime.state.config
  stopReconnecting()
  stopHomeSnapshot()
  void calls.finish().catch(() => {})
  calls.reset('')
  const epoch = ++runtime.generation
  disposeEvents()
  runtime.activeID = ''
  runtime.pendingMessages = []
  messaging.reset()
  runtime.update({
    session: undefined,
    offline: false,
    startupSnapshot: undefined,
    busy: true,
    status: 'signedOut',
    error,
    conversationsLoaded: false,
    conversations: [],
    messages: {},
    historyEnd: {},
    historyLoading: {},
    historyPaging: {},
  })
  try {
    await storage.removeItem(key)
    if (reason)
      await storage.setItem(signOutReasonKey, reason)
    if (previousSession)
      await homeSnapshots.remove(previousSession.userID, previousConfig)
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

export function syncMessageReaders (conversationID: string, messageID: string, readCount: number, unreadCount: number, guard?: GroupMessageReadGuard) {
  runtime.syncMessageReaders(conversationID, messageID, readCount, unreadCount, guard)
}

/** Search pages stay separate so sparse hits cannot create gaps in chat history. */
/** Start local history retrieval before navigation; focus owns visible error reporting/retry. */
export function prefetchConversationHistory (id: string) {
  return messaging.loadHistory(id).catch(() => {
    // The focused conversation joins this request (or retries it) and reports current-session errors.
  })
}

export async function loadServerHistory (request: ServerHistoryRequest) {
  const { session, config } = runtime.state
  if (!session)
    throw new ProductError('session.signInFirst')
  const epoch = runtime.generation
  const revision = runtime.historyRevision?.[request.conversationID] || 0
  const result = await fetchServerHistory(session, config.chat, request)
  if (epoch !== runtime.generation || revision !== (runtime.historyRevision?.[request.conversationID] || 0))
    throw new ProductError('session.changedReload')
  return result
}

export async function ensureMessageLoaded (id: string, messageID: string, isCurrent: () => boolean = () => true) {
  if ((runtime.state.messages[id] || []).some(message => message.clientMsgID === messageID))
    return
  let cursor = ''
  const visited = new Set<string>()
  const epoch = runtime.generation
  const revision = runtime.historyRevision?.[id] || 0
  while (true) {
    if (!isCurrent() || epoch !== runtime.generation || revision !== (runtime.historyRevision?.[id] || 0))
      throw new ProductError('history.pageChanged')
    const page = await loadServerHistory({ conversationID: id, cursor })
    if (!isCurrent() || epoch !== runtime.generation)
      throw new ProductError('history.signInChanged')
    runtime.addMessages(id, page.messages)
    if (page.messages.some(message => message.clientMsgID === messageID))
      return
    if (!page.hasMore)
      throw new ProductError('history.messageGone')
    if (visited.has(page.cursor))
      throw new ProductError('history.notAdvancing')
    visited.add(page.cursor)
    cursor = page.cursor
  }
}

async function recheckAttachmentDelivery (conversationID: string, message: import('../domain/types').IMMessage) {
  const epoch = runtime.generation
  let cursor = ''
  const visited = new Set<string>()
  while (true) {
    if (epoch !== runtime.generation)
      throw new ProductError('attachments.signInChanged')
    const page = await loadServerHistory({ conversationID, cursor })
    const delivered = page.messages.find(item => item.clientMsgID === message.clientMsgID)
    if (delivered)
      return true
    if (!page.hasMore)
      return false
    if (visited.has(page.cursor))
      throw new ProductError('attachments.deliveryUnknown')
    visited.add(page.cursor)
    cursor = page.cursor
  }
}

// A replaced store must stop consuming SDK events; the page SDK/session stay alive.
if (typeof module !== 'undefined' && module.hot)
  module.hot.dispose(() => {
    // Metro retains the hot object but invokes dispose without a data argument.
    stopHomeSnapshot()
    module.hot!.data = { snapshot: runtime.snapshot() }
    ++runtime.generation
    disposeEvents()
    calls.reset('')
  })
