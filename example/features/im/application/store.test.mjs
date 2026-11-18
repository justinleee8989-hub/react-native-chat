import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import * as model from '../domain/model.ts'
import { groupReadCount } from '../messages/presentation.ts'

const conversation = { conversationType: 1, conversationID: 'chat-bob', userID: 'bob', showName: 'Bob', unreadCount: 0 }
const message = { clientMsgID: 'offline-1', sendID: 'bob', recvID: 'me', sendTime: 123, status: 2, contentType: 101, textElem: { content: 'While offline' } }
const settle = () => new Promise(resolve => setImmediate(resolve))
function harness (loginResponse = async () => ({ data: { userID: 'me', imToken: 'test-only', chatToken: 'chat-only' } }), options = {}) {
  const effects = []
  let savedSession = options.savedSession || null
  let removeCount = 0
  const otherStorage = new Map(options.snapshotEntries || [])
  const storage = {
    getItem: async key => key === 'openim-example-session-v1' ? savedSession : otherStorage.get(key) ?? null,
    setItem: async (key, value) => { if (key === 'openim-example-session-v1') savedSession = value; else otherStorage.set(key, value) },
    removeItem: async key => { if (key === 'openim-example-session-v1') { savedSession = null; removeCount++ } else otherStorage.delete(key) },
  }
  const events = new Map()
  const eventSubscriptions = new Map()
  let history = []
  let historyCalls = 0
  const client = {
    login: async () => {}, logout: async () => {}, read: async () => {},
    on: (event, handler) => {
      events.set(event, handler)
      const subscriptions = eventSubscriptions.get(event) || new Set()
      subscriptions.add(handler)
      eventSubscriptions.set(event, subscriptions)
      return () => {
        subscriptions.delete(handler)
        if (events.get(event) === handler) events.delete(event)
      }
    },
    conversations: async () => options.conversations || [conversation],
    history: async () => { historyCalls++; return { messageList: history, isEnd: true } },
  }
  const modules = new Map()
  const moduleDisposers = new Map()
  const hotModules = new Map()
  function load (url) {
    if (modules.has(url.href)) return modules.get(url.href)
    const disposeCallbacks = []
    const hot = hotModules.get(url.href) || { data: {} }
    hot.dispose = callback => disposeCallbacks.push(callback)
    hotModules.set(url.href, hot)
    const module = { exports: {}, hot }
    moduleDisposers.set(url.href, disposeCallbacks)
    modules.set(url.href, module.exports)
    const { outputText } = ts.transpileModule(readFileSync(url, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    })
    runInNewContext(outputText, {
      exports: module.exports, module, AbortController, setTimeout, clearTimeout,
      fetch: async url => url.includes('/user/message/history')
        ? ({ ok: true, json: async () => ({ errCode: 0, data: { messages: [], hasMore: false, cursor: '' } }) })
        : url.includes('/user/message/extras') && options.projectionFailure
        ? ({ ok: false, json: async () => ({ errCode: 500, errMsg: 'projection unavailable' }) })
        : ({ ok: true, json: async () => await loginResponse(url) }),
      require: name => {
        if (name === 'react') return { useEffect: effect => effects.push(effect), useSyncExternalStore: (_subscribe, snapshot) => snapshot() }
        if (name === 'md5') return () => 'test-only'
        if (name.endsWith('/openim/client')) return { client }
        if (name.endsWith('/openim/conversation-client')) return { conversationService: options.conversationService || {} }
        if (name === '../config') return { defaultConfig: { chat: 'http://test' }, platformID: 5 }
        if (name === '../domain/model') return model
        if (name.endsWith('/storage/attachment-outbox')) return { attachmentOutbox: { load: async () => [], save: async () => {}, remove: async () => {}, retain: async (_scope, _id, media) => media } }
        if (name.endsWith('/openim/composer-storage')) return { setDraftStorageScope: () => {} }
        if (name.endsWith('/storage/storage')) return { storage }
        if (name.startsWith('.')) return load(new URL(name.endsWith('.ts') ? name : name + '.ts', url))
        throw new Error(`Unexpected dependency ${name}`)
      },
    })
    return module.exports
  }
  const storeUrl = new URL('./store.ts', import.meta.url)
  const store = load(storeUrl)
  return { store, client, events, storage, snapshotEntries: () => [...otherStorage],
    // The home snapshots alone: other entries (the last account) outlive a sign-out on purpose.
    homeEntries: () => [...otherStorage].filter(([name]) => name.startsWith('openim-home-v1')), savedSession: () => savedSession, removeCount: () => removeCount,
    mount: (target = store) => { target.useOpenIM(); effects.pop()() },
    reloadStore: () => {
      for (const dispose of moduleDisposers.get(storeUrl.href) || []) dispose()
      modules.delete(storeUrl.href)
      return load(storeUrl)
    },
    subscriptionCount: () => [...eventSubscriptions.values()].reduce((count, subscriptions) => count + subscriptions.size, 0),
    setHistory: value => { history = value }, historyCalls: () => historyCalls }
}

test('offline SDK messages update the current chat without leaving it and remain deduplicated', async () => {
  const { store, events } = harness()
  await store.login('me', 'password', { chat: 'http://test' })
  store.focusConversation('chat-bob')
  await settle()
  assert.equal(typeof events.get('onRecvOfflineNewMessage'), 'function')
  assert.equal(typeof events.get('onRecvOfflineNewMessages'), 'function')
  events.get('onRecvOfflineNewMessage')(message)
  events.get('onRecvOfflineNewMessages')([message])
  assert.equal(store.useOpenIM().messages['chat-bob'].length, 1)
})

test('sync completion reloads the active conversation history after reconnect', async () => {
  const { store, events, setHistory, historyCalls } = harness()
  await store.login('me', 'password', { chat: 'http://test' })
  store.focusConversation('chat-bob')
  await settle()
  setHistory([message])
  events.get('onSyncServerFinish')()
  await settle()
  assert.equal(historyCalls(), 2)
  assert.equal(store.useOpenIM().messages['chat-bob'][0].clientMsgID, 'offline-1')
})

test('foreground recovery coalesces refreshes and reloads history only while the same chat remains active', async () => {
  const h = harness()
  await h.store.login('me', 'password', { chat: 'http://test' })
  const session = h.store.useOpenIM().session
  const stop = h.store.focusConversation('chat-bob')
  await settle()
  const initialHistoryCalls = h.historyCalls()
  let finishRefresh
  let refreshCalls = 0
  h.client.conversations = () => {
    refreshCalls++
    return new Promise(resolve => { finishRefresh = resolve })
  }

  const first = h.store.resumeConversation('chat-bob', session)
  const second = h.store.resumeConversation('chat-bob', session)
  await Promise.resolve()
  assert.equal(refreshCalls, 1)
  finishRefresh([conversation])
  await Promise.all([first, second])
  assert.equal(h.historyCalls(), initialHistoryCalls + 1)

  let finishStaleRefresh
  h.client.conversations = () => new Promise(resolve => { finishStaleRefresh = resolve })
  const stale = h.store.resumeConversation('chat-bob', session)
  await Promise.resolve()
  stop()
  finishStaleRefresh([conversation])
  await stale
  assert.equal(h.historyCalls(), initialHistoryCalls + 1)
})

test('foreground recovery does not load history into a replacement session', async () => {
  let loginCount = 0
  const h = harness(async () => ({ data: { userID: `account-${++loginCount}`, imToken: 'test-only', chatToken: 'chat-only' } }))
  await h.store.login('first', 'password', { chat: 'http://test' })
  const oldSession = h.store.useOpenIM().session
  h.store.focusConversation('chat-bob')
  await settle()
  let finishOldRefresh
  h.client.conversations = () => new Promise(resolve => { finishOldRefresh = resolve })
  const stale = h.store.resumeConversation('chat-bob', oldSession)
  await Promise.resolve()
  await h.store.logout()
  h.client.conversations = async () => [conversation]
  await h.store.login('second', 'password', { chat: 'http://test' })
  h.store.focusConversation('chat-bob')
  await settle()
  const replacementHistoryCalls = h.historyCalls()
  finishOldRefresh([conversation])
  await stale
  assert.equal(h.store.useOpenIM().session.userID, 'account-2')
  assert.equal(h.historyCalls(), replacementHistoryCalls)
})

test('initial login retains a non-blocking message projection warning', async () => {
  const latest = { clientMsgID: 'latest', status: 2, contentType: 101, textElem: { content: 'original' } }
  const { store } = harness(undefined, {
    conversations: [{ ...conversation, latestMsg: JSON.stringify(latest) }],
    projectionFailure: true,
  })
  await store.login('me', 'password', { chat: 'http://test' })
  const state = store.useOpenIM()
  assert.equal(state.session.userID, 'me')
  assert.match(state.error, /编辑信息暂时无法同步/)
  assert.equal(JSON.parse(state.conversations[0].latestMsg).textElem.content, 'original')
})

test('a rejected refresh from a previous login cannot change the current account status', async () => {
  let logins = 0
  const h = harness(async () => ({ data: { userID: `account-${++logins}`, imToken: 'test-only', chatToken: 'chat-only' } }))
  await h.store.login('first', 'password', { chat: 'http://test' })
  let rejectRefresh
  h.client.conversations = () => new Promise((_resolve, reject) => { rejectRefresh = reject })
  let staleErrorReported = false
  const staleRefresh = h.store.refresh().catch(error => {
    staleErrorReported = true
    h.store.reportError(error)
  })
  await Promise.resolve()
  await h.store.logout()
  h.client.conversations = async () => [conversation]
  await h.store.login('second', 'password', { chat: 'http://test' })
  const before = h.store.useOpenIM()
  rejectRefresh(new Error('old account network failure'))
  await staleRefresh
  const after = h.store.useOpenIM()
  assert.equal(after.session.userID, 'account-2')
  assert.equal(after.status, before.status)
  assert.equal(after.error, before.error)
  assert.equal(staleErrorReported, false)
})

test('a stale restore refresh cannot clear the busy state of a new login', async () => {
  let loginCount = 0
  let finishSecondLogin
  const h = harness(async () => {
    if (++loginCount === 1)
      return { data: { userID: 'first', imToken: 'test-only', chatToken: 'chat-only' } }
    return new Promise(resolve => { finishSecondLogin = resolve })
  })
  await h.store.login('first', 'password', { chat: 'http://test' })
  let rejectRefresh
  h.client.conversations = () => new Promise((_resolve, reject) => { rejectRefresh = reject })
  const staleRetry = h.store.retryRestore()
  await Promise.resolve()
  await h.store.logout()
  h.client.conversations = async () => [conversation]
  const newLogin = h.store.login('second', 'password', { chat: 'http://test' })
  await Promise.resolve()
  await Promise.resolve()
  assert.equal(h.store.useOpenIM().busy, true)
  rejectRefresh(new Error('old refresh failed'))
  await staleRetry
  assert.equal(h.store.useOpenIM().busy, true)
  finishSecondLogin({ data: { userID: 'second', imToken: 'test-only', chatToken: 'chat-only' } })
  await newLogin
  assert.equal(h.store.useOpenIM().session.userID, 'second')
})


test('media upload failure keeps one retryable message and progress events update the official ring', async () => {
  const { store, client, events } = harness()
  await store.login('me', 'password', { chat: 'http://test' })
  const media = { ...message, clientMsgID: 'upload-1', sendID: 'me', recvID: 'bob', contentType: 105, fileElem: { fileName: 'report.pdf', filePath: 'blob:local' } }
  client.createMedia = async () => media
  let attempts = 0
  client.send = async outgoing => {
    attempts++
    events.get('onProgress')({ clientMsgID: outgoing.clientMsgID, progress: 42 })
    assert.equal(store.useOpenIM().messages['chat-bob'][0].uploadProgress, 42)
    if (attempts === 1) throw new Error('Upload disconnected')
    return { ...outgoing, status: 2, fileElem: { ...outgoing.fileElem, sourceUrl: 'https://storage/report.pdf' } }
  }
  await assert.rejects(store.sendMedia('chat-bob', { type: 'file', uri: 'blob:local' }), /Upload disconnected/)
  const failed = store.useOpenIM().messages['chat-bob'][0]
  assert.equal(failed.status, 3)
  assert.equal(failed.fileElem.filePath, 'blob:local')
  await store.retryMessage('chat-bob', failed)
  assert.equal(attempts, 2)
  assert.equal(store.useOpenIM().messages['chat-bob'].length, 1)
  assert.equal(store.useOpenIM().messages['chat-bob'][0].status, 2)
  assert.equal(store.useOpenIM().messages['chat-bob'][0].fileElem.sourceUrl, 'https://storage/report.pdf')
})

test('duplicate retry taps do not issue concurrent SDK sends', async () => {
  const { store, client } = harness()
  await store.login('me', 'password', { chat: 'http://test' })
  let finish
  let calls = 0
  client.send = async outgoing => { calls++; await new Promise(resolve => { finish = resolve }); return { ...outgoing, status: 2 } }
  const first = store.retryMessage('chat-bob', message)
  await store.retryMessage('chat-bob', message)
  assert.equal(calls, 1)
  finish()
  await first
})


test('logout during pending HTTP login prevents late response from resurrecting session', async () => {
  let finish
  const response = new Promise(resolve => { finish = resolve })
  const { store } = harness(() => response)
  const login = store.login('me', 'password', { chat: 'http://test' })
  await settle()
  await store.logout()
  finish({ data: { userID: 'me', imToken: 'late', chatToken: 'late-chat' } })
  await login
  assert.equal(store.useOpenIM().session, undefined)
})


test('late restore cannot revive a logged out account', async () => {
  const h = harness()
  let finish
  h.storage.getItem = () => new Promise(resolve => { finish = resolve })
  h.mount()
  await h.store.logout()
  finish(JSON.stringify({ session: { userID: 'old', imToken: 'old' }, config: { chat: 'http://test' } }))
  await settle()
  assert.equal(h.store.useOpenIM().session, undefined)
})

test('storage removal failure does not skip SDK logout', async () => {
  const h = harness()
  await h.store.login('me', 'password', { chat: 'http://test' })
  let calls = 0
  h.storage.removeItem = async () => { throw new Error('storage unavailable') }
  h.client.logout = async () => { calls++ }
  await h.store.logout()
  assert.equal(calls, 1)
  assert.equal(h.store.useOpenIM().session, undefined)
})

test('store module reload restores the session without duplicating SDK event subscriptions', async () => {
  const h = harness()
  await h.store.login('me', 'password', { chat: 'http://test' })
  let releaseStaleRefresh
  const conversations = h.client.conversations
  h.client.conversations = () => new Promise(resolve => { releaseStaleRefresh = resolve })
  const staleRetry = h.store.retryRestore()
  await settle()
  assert.equal(h.store.useOpenIM().busy, true)
  const beforeReload = h.store.useOpenIM()
  const subscriptionsBeforeReload = h.subscriptionCount()
  assert.ok(subscriptionsBeforeReload > 0)

  const reloadedStore = h.reloadStore()
  const beforeRestoreMount = reloadedStore.useOpenIM()
  assert.equal(beforeRestoreMount.session?.userID, beforeReload.session?.userID,
    'the replacement store must expose the previous session before restore runs')
  assert.equal(beforeRestoreMount.status, beforeReload.status)
  assert.equal(beforeRestoreMount.busy, false, 'a disposed busy operation must not block the new restore')
  assert.deepEqual(beforeRestoreMount.conversations, beforeReload.conversations)
  assert.deepEqual(beforeRestoreMount.messages, beforeReload.messages)

  h.client.conversations = conversations
  h.mount(reloadedStore)
  await settle()
  await settle()
  assert.equal(reloadedStore.useOpenIM().session?.userID, 'me')
  assert.equal(reloadedStore.useOpenIM().busy, false, 'restore must finish without waiting for the stale request')
  releaseStaleRefresh([conversation])
  await staleRetry
  assert.equal(reloadedStore.useOpenIM().busy, false, 'the stale retry must not change the new store busy state')
  assert.equal(h.subscriptionCount(), subscriptionsBeforeReload,
    'the previous module must release its subscriptions before the reloaded store subscribes')
})

test('store module disposal clears subscriptions and fences an in-flight SDK login', async () => {
  const h = harness()
  let loginStarted
  let finishSDKLogin
  const started = new Promise(resolve => { loginStarted = resolve })
  h.client.login = () => {
    loginStarted()
    return new Promise(resolve => { finishSDKLogin = resolve })
  }
  const oldStore = h.store
  const pendingLogin = oldStore.login('me', 'password', { chat: 'http://test' })
  await started
  assert.ok(h.subscriptionCount() > 0)

  h.reloadStore()
  assert.equal(h.subscriptionCount(), 0, 'dispose must release the old store event subscriptions')
  finishSDKLogin()
  await pendingLogin
  assert.equal(oldStore.useOpenIM().session, undefined, 'a login from a disposed module must not revive its old session')
})

test('opening an empty new conversation does not mark nonexistent server history read', async () => {
  const { store, client } = harness()
  let reads = 0
  client.read = async () => { reads++; throw new Error('1004 RecordNotFoundError') }
  await store.login('me', 'password', { chat: 'http://test' })
  store.focusConversation('chat-bob')
  await settle()
  assert.equal(reads, 0)
  assert.equal(store.useOpenIM().error, '')
})

test('checked call invite send rejects when SDK send fails', async () => {
  const { store, client } = harness()
  await store.login('me', 'password', { chat: 'http://test' })
  client.conversation = async () => conversation
  client.createText = async text => ({ ...message, clientMsgID: 'invite-1', textElem: { content: text } })
  client.send = async () => { throw new Error('group send denied') }
  await assert.rejects(store.sendTextChecked('chat-bob', '[call invite]'), /group send denied/)
  assert.equal(store.useOpenIM().messages['chat-bob'].find(item => item.clientMsgID === 'invite-1').status, 3)
})

test('checked call invite send resolves only after SDK delivery succeeds', async () => {
  const { store, client } = harness()
  await store.login('me', 'password', { chat: 'http://test' })
  client.conversation = async () => conversation
  client.createText = async text => ({ ...message, clientMsgID: 'invite-2', textElem: { content: text } })
  let sends = 0
  client.send = async outgoing => { sends++; return { ...outgoing, status: 2 } }
  await store.sendTextChecked('chat-bob', '[call invite]')
  assert.equal(sends, 1)
  assert.equal(store.useOpenIM().messages['chat-bob'].find(item => item.clientMsgID === 'invite-2').status, 2)
})

test('retrying a call invitation checks server authority before sending it', async () => {
  const h = harness()
  await h.store.login('me', 'password', { chat: 'http://test' })
  let sends = 0
  h.client.send = async outgoing => { sends++; return { ...outgoing, status: 2 } }
  const invite = { ...message, clientMsgID: 'old-call-invite', sendID: 'me', recvID: 'bob', status: 3,
    textElem: { content: '[OpenIM 通话邀请] {"room":"imcall-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","expires":9999999999999}' } }
  await h.store.retryMessage('chat-bob', invite)
  assert.equal(sends, 0)
  assert.equal(h.store.useOpenIM().messages['chat-bob'].find(item => item.clientMsgID === invite.clientMsgID).status, 3)
  assert.match(h.store.useOpenIM().error, /通话服务不可用/)
})

test('a network failure at SDK login keeps the user in the app and reconnects on retry', async () => {
  const h = harness()
  let attempts = 0
  h.client.login = async () => { if (++attempts === 1) throw new Error('connection refused') }
  await h.store.login('me', 'password', { chat: 'http://test' })
  const state = h.store.useOpenIM()
  assert.equal(state.session.userID, 'me')
  assert.equal(state.offline, true)
  assert.equal(state.status, '网络异常，无法连接服务器')
  assert.equal(state.error, '')
  assert.equal(state.busy, false)
  assert.ok(h.savedSession())
  assert.equal(h.removeCount(), 0)
  // A pull or the chat list's sync goes through refresh, which reconnects while offline.
  await h.store.refresh()
  assert.equal(attempts, 2)
  assert.equal(h.store.useOpenIM().offline, false)
  assert.equal(h.store.useOpenIM().status, '已连接')
  assert.equal(h.store.useOpenIM().session.userID, 'me')
  assert.equal(h.removeCount(), 0)
  await h.store.logout()
})

test('cold restore without a reachable server opens on the cached list and reconnects by itself', async () => {
  const first = harness()
  await first.store.login('me', 'password', { chat: 'http://test' })
  await new Promise(resolve => setTimeout(resolve, 300))
  const second = harness(undefined, { savedSession: first.savedSession(), snapshotEntries: first.snapshotEntries() })
  let attempts = 0
  second.client.login = async () => { if (++attempts === 1) throw new Error('network request failed') }
  second.mount()
  await settle()
  const offline = second.store.useOpenIM()
  assert.equal(offline.initialized, true)
  assert.equal(offline.session.userID, 'me')
  assert.equal(offline.offline, true)
  assert.equal(offline.conversations[0].conversationID, 'chat-bob')
  // The first automatic retry is 2s later.
  await new Promise(resolve => setTimeout(resolve, 2200))
  assert.equal(attempts, 2)
  assert.equal(second.store.useOpenIM().offline, false)
  assert.equal(second.store.useOpenIM().status, '已连接')
  await second.store.logout()
})

test('a lost connection says only that the network is down until the SDK connects again', async () => {
  const h = harness()
  await h.store.login('me', 'password', { chat: 'http://test' })
  assert.equal(h.store.useOpenIM().status, '已连接')
  h.events.get('onConnectFailed')()
  assert.equal(h.store.useOpenIM().status, '网络异常，无法连接服务器')
  // The SDK's own retries and a refresh answered from its local database leave it up.
  h.events.get('onConnecting')()
  await h.store.refresh()
  assert.equal(h.store.useOpenIM().status, '网络异常，无法连接服务器')
  assert.equal(h.store.useOpenIM().session.userID, 'me')
  // An action failing meanwhile says the same, not its own generic error.
  h.store.reportError(new Error('sdk not login'))
  assert.equal(h.store.useOpenIM().error, '网络异常，无法连接服务器')
  h.events.get('onConnectSuccess')()
  assert.equal(h.store.useOpenIM().status, '已连接')
  h.store.reportError(new Error('sdk not login'))
  assert.equal(h.store.useOpenIM().error, '操作失败，请稍后重试')
  await h.store.logout()
})

test('signing out while offline stops reconnecting', async () => {
  const h = harness()
  let attempts = 0
  h.client.login = async () => { attempts++; throw new Error('connection refused') }
  await h.store.login('me', 'password', { chat: 'http://test' })
  assert.equal(h.store.useOpenIM().offline, true)
  await h.store.logout()
  assert.equal(h.store.useOpenIM().offline, false)
  await new Promise(resolve => setTimeout(resolve, 2200))
  assert.equal(attempts, 1)
  assert.equal(h.store.useOpenIM().session, undefined)
})

test('explicit expired or invalid OpenIM login tokens clear saved credentials', async () => {
  const h = harness()
  let logouts = 0
  h.client.login = async () => { throw Object.assign(new Error('token rejected'), { code: '1502' }) }
  h.client.logout = async () => { logouts++ }
  await h.store.login('me', 'password', { chat: 'http://test' })
  assert.equal(h.store.useOpenIM().session, undefined)
  assert.equal(h.savedSession(), null)
  assert.equal(h.removeCount(), 1)
  assert.equal(logouts, 1)
  assert.equal(h.store.useOpenIM().error, '登录已失效，请重新登录')
  // The login page is filled in with the account, so only the password is asked.
  assert.equal(h.store.useOpenIM().lastAccount.account, 'me')
})

test('temporary conversation refresh failure preserves saved login for retry', async () => {
  const h = harness()
  let refreshes = 0
  let logins = 0
  let logouts = 0
  h.client.login = async () => { logins++ }
  h.client.logout = async () => { logouts++ }
  h.client.conversations = async () => { if (++refreshes === 1) throw new Error('server unavailable'); return [conversation] }
  await h.store.login('me', 'password', { chat: 'http://test' })
  assert.equal(h.store.useOpenIM().session.userID, 'me')
  assert.equal(h.store.useOpenIM().status, '同步暂时失败')
  assert.equal(logins, 1)
  assert.equal(logouts, 0)
  assert.equal(typeof h.events.get('onConnectSuccess'), 'function')
  assert.ok(h.savedSession())
  assert.equal(h.removeCount(), 0)
  await h.store.retryRestore()
  assert.equal(h.store.useOpenIM().session.userID, 'me')
  assert.equal(h.removeCount(), 0)
  assert.equal(logins, 1)
  assert.equal(logouts, 0)
  assert.equal(h.store.useOpenIM().status, '已连接')
})

test('explicit invalid-token event clears saved login', async () => {
  const h = harness()
  await h.store.login('me', 'password', { chat: 'http://test' })
  assert.ok(h.savedSession())
  h.events.get('onUserTokenInvalid')()
  await settle()
  assert.equal(h.store.useOpenIM().session, undefined)
  assert.equal(h.savedSession(), null)
  assert.equal(h.removeCount(), 1)
  assert.equal(h.store.useOpenIM().lastAccount.account, 'me')
})

test('a tab signed out by another sign-in says so after the web reload, once', async () => {
  const first = harness()
  await first.store.login('me', 'password', { chat: 'http://test' })
  first.events.get('onKickedOffline')()
  await settle()
  assert.equal(first.store.useOpenIM().session, undefined)
  assert.match(first.store.useOpenIM().error, /其他设备或浏览器标签页登录/)
  // The page reloads: a fresh store over the same tab storage.
  const reloaded = harness(undefined, { snapshotEntries: first.snapshotEntries() })
  reloaded.mount()
  await settle()
  assert.match(reloaded.store.useOpenIM().error, /其他设备或浏览器标签页登录/)
  const again = harness(undefined, { snapshotEntries: reloaded.snapshotEntries() })
  again.mount()
  await settle()
  assert.equal(again.store.useOpenIM().error, '')
})

test('an expired login is not reported as a sign-in elsewhere', async () => {
  const h = harness()
  await h.store.login('me', 'password', { chat: 'http://test' })
  h.events.get('onUserTokenExpired')()
  await settle()
  assert.equal(h.store.useOpenIM().error, '登录已失效，请重新登录')
})

test('read receipts update only the matching outgoing message and never mark partial group reads as fully read', async () => {
  const h = harness()
  await h.store.login('me', 'password', { chat: 'http://test' })
  const group = { conversationID: 'group-chat', groupID: 'group-1', showName: 'Group', unreadCount: 0 }
  const otherGroup = { conversationID: 'other-group-chat', groupID: 'group-2', showName: 'Other', unreadCount: 0 }
  h.events.get('onConversationChanged')([group, otherGroup])
  const sentC2C = { ...message, clientMsgID: 'sent-c2c', sendID: 'me', recvID: 'bob', groupID: '', status: 2, isRead: false }
  const sentGroup = { ...message, clientMsgID: 'sent-group', sendID: 'me', recvID: '', groupID: 'group-1', status: 2, isRead: false }
  const sentOtherGroup = { ...message, clientMsgID: 'sent-other-group', sendID: 'me', recvID: '', groupID: 'group-2', status: 2, isRead: false }
  h.events.get('onRecvNewMessages')([sentC2C, sentGroup, sentOtherGroup])
  h.events.get('onRecvC2CReadReceipt')([
    { userID: 'mallory', groupID: '', msgIDList: ['sent-c2c'], sessionType: 1 },
  ])
  assert.equal(h.store.useOpenIM().messages['chat-bob'].find(item => item.clientMsgID === 'sent-c2c').isRead, false)
  h.events.get('onRecvC2CReadReceipt')([
    { userID: 'bob', groupID: '', msgIDList: ['sent-c2c'], sessionType: 1 },
  ])
  assert.equal(h.store.useOpenIM().messages['chat-bob'].find(item => item.clientMsgID === 'sent-c2c').isRead, true)
  h.events.get('onRecvGroupReadReceipt')({ conversationID: 'group-chat', groupMessageReadInfo: [
    { clientMsgID: 'sent-group', hasReadCount: 1, unreadCount: 2, readMembers: [{ userID: 'alice' }] },
  ] })
  assert.equal(h.store.useOpenIM().messages['group-chat'].find(item => item.clientMsgID === 'sent-group').isRead, false)
  assert.equal(h.store.useOpenIM().messages['other-group-chat'].find(item => item.clientMsgID === 'sent-other-group').isRead, false)
  h.events.get('onRecvGroupReadReceipt')({ conversationID: 'group-chat', groupMessageReadInfo: [
    { clientMsgID: 'sent-group', hasReadCount: 3, unreadCount: 0, readMembers: [{ userID: 'alice' }, { userID: 'bob' }, { userID: 'carol' }] },
  ] })
  assert.equal(h.store.useOpenIM().messages['group-chat'].find(item => item.clientMsgID === 'sent-group').isRead, true)
})

test('authoritative group reader details synchronize the matching cached message count', async () => {
  const h = harness()
  await h.store.login('me', 'password', { chat: 'http://test' })
  const group = { conversationID: 'group-chat', groupID: 'group-1', showName: 'Group', unreadCount: 0 }
  h.events.get('onConversationChanged')([group])
  const sent = { ...message, clientMsgID: 'sent-group', sendID: 'me', recvID: '', groupID: 'group-1', status: 2 }
  h.events.get('onRecvNewMessages')([sent])

  h.store.syncMessageReaders('group-chat', 'sent-group', 1, 0)

  const cached = h.store.useOpenIM().messages['group-chat'].find(item => item.clientMsgID === 'sent-group')
  assert.equal(groupReadCount(cached, h.store.useOpenIM().messageReadInfo['group-chat']['sent-group'].readCount), 1)
  h.setHistory([{ ...sent, attachedInfoElem: { groupHasReadInfo: { hasReadCount: 0, unreadCount: 3 } }, isRead: false }])
  await h.store.loadHistory('group-chat')
  const restored = h.store.useOpenIM().messages['group-chat'].find(item => item.clientMsgID === 'sent-group')
  const authoritative = h.store.useOpenIM().messageReadInfo['group-chat']['sent-group'].readCount
  assert.equal(groupReadCount(restored), 0)
  assert.equal(groupReadCount(restored, authoritative), 1)
  assert.equal(restored.isRead, false)
  assert.equal((h.store.useOpenIM().messages['chat-bob'] || []).some(item => item.clientMsgID === 'sent-group'), false)
})

test('a stale reader request cannot overwrite a newer SDK receipt for the same message', async () => {
  const h = harness()
  await h.store.login('me', 'password', { chat: 'http://test' })
  h.events.get('onConversationChanged')([{ conversationID: 'group-chat', groupID: 'group-1', showName: 'Group', unreadCount: 0 }])
  h.events.get('onRecvNewMessages')([{ ...message, clientMsgID: 'sent-group', sendID: 'me', recvID: '', groupID: 'group-1', status: 2 }])
  h.store.syncMessageReaders('group-chat', 'sent-group', 2, 0)
  const receiptState = h.store.useOpenIM().messageReadInfo['group-chat']['sent-group']

  h.store.syncMessageReaders('group-chat', 'sent-group', 1, 2, {
    readInfo: undefined,
    userID: 'me',
    imToken: 'test-only',
    chatToken: 'chat-only',
  })

  assert.equal(h.store.useOpenIM().messageReadInfo['group-chat']['sent-group'], receiptState)
  assert.equal(h.store.useOpenIM().messageReadInfo['group-chat']['sent-group'].readCount, 2)
  assert.equal(h.store.useOpenIM().messageReadInfo['group-chat']['sent-group'].unreadCount, 0)
})

test('a chat server group read notice asks the open group chat to refresh its read count', async () => {
  const h = harness()
  await h.store.login('me', 'password', { chat: 'http://test' })
  h.events.get('onConversationChanged')([{ conversationID: 'group-chat', groupID: 'group-1', showName: 'Group', unreadCount: 0 }])
  const notice = (conversationID) => JSON.stringify({ key: 'group_read_progress', data: JSON.stringify({ conversationID, readerID: 'bob', hasReadSeq: 3 }) })

  h.events.get('onRecvCustomBusinessMessage')(notice('group-chat'))
  assert.equal(h.store.useOpenIM().readersChanged?.['group-chat'], undefined, 'not a group conversation ID')

  h.events.get('onConversationChanged')([{ conversationID: 'sg_group-1', groupID: 'group-1', showName: 'Group', unreadCount: 0 }])
  h.events.get('onRecvCustomBusinessMessage')(notice('sg_group-1'))
  h.events.get('onRecvCustomBusinessMessage')(notice('sg_group-1'))
  assert.equal(h.store.useOpenIM().readersChanged['sg_group-1'], 2)
  h.events.get('onRecvCustomBusinessMessage')(notice('sg_unknown'))
  assert.equal(h.store.useOpenIM().readersChanged['sg_unknown'], undefined)
})

test('the same read counts leave the store state untouched', async () => {
  const h = harness()
  await h.store.login('me', 'password', { chat: 'http://test' })
  h.events.get('onConversationChanged')([{ conversationID: 'group-chat', groupID: 'group-1', showName: 'Group', unreadCount: 0 }])
  h.events.get('onRecvNewMessages')([{ ...message, clientMsgID: 'sent-group', sendID: 'me', recvID: '', groupID: 'group-1', status: 2 }])
  h.store.syncMessageReaders('group-chat', 'sent-group', 1, 1)
  const before = h.store.useOpenIM()

  h.store.syncMessageReaders('group-chat', 'sent-group', 1, 1)
  assert.equal(h.store.useOpenIM(), before)

  h.store.syncMessageReaders('group-chat', 'sent-group', 2, 0)
  assert.equal(h.store.useOpenIM().messageReadInfo['group-chat']['sent-group'].readCount, 2)
})


test('session initialization waits for storage before allowing an unauthenticated redirect', async () => {
  const h = harness()
  let finishRead
  // Hold only the saved-session read: after it the store also reads the sign-out reason, and a
  // stub that never answers that one kept initialization pending forever.
  const getItem = h.storage.getItem
  h.storage.getItem = key => key === 'openim-example-session-v1' ? new Promise(resolve => { finishRead = resolve }) : getItem(key)
  assert.equal(h.store.useOpenIM().initialized, false)
  h.mount()
  assert.equal(h.store.useOpenIM().initialized, false)
  assert.equal(h.store.useOpenIM().busy, true)
  finishRead(null)
  await settle()
  assert.equal(h.store.useOpenIM().initialized, true)
  assert.equal(h.store.useOpenIM().busy, false)
  assert.equal(h.store.useOpenIM().session, undefined)
})

test('an unreadable saved login is read again once, then leaves the plain login page', async () => {
  const h = harness()
  let reads = 0
  h.storage.getItem = async key => {
    if (key === 'openim-example-session-v1')
      reads++
    throw new Error('storage unavailable')
  }
  h.mount()
  await settle()
  assert.equal(reads, 2)
  assert.equal(h.store.useOpenIM().initialized, true)
  assert.equal(h.store.useOpenIM().busy, false)
  assert.equal(h.store.useOpenIM().session, undefined)
  assert.equal(h.store.useOpenIM().error, '无法读取已保存的登录信息，请重新登录')
})

test('the last account survives a manual sign-out and a cold start, to fill the login page', async () => {
  const first = harness()
  await first.store.login('alice@example.com', 'password', { chat: 'http://test' })
  await first.store.logout()
  assert.equal(first.store.useOpenIM().lastAccount.account, 'alice@example.com')
  const second = harness(undefined, { snapshotEntries: first.snapshotEntries() })
  second.mount()
  await settle()
  assert.equal(second.store.useOpenIM().session, undefined)
  assert.equal(JSON.stringify(second.store.useOpenIM().lastAccount), JSON.stringify({ account: 'alice@example.com', config: { chat: 'http://test' } }))
})


test('cold restore displays an account snapshot without treating it as authenticated', async () => {
  const first = harness()
  await first.store.login('me', 'password', { chat: 'http://test' })
  await new Promise(resolve => setTimeout(resolve, 300))
  const second = harness(undefined, { savedSession: first.savedSession(), snapshotEntries: first.snapshotEntries() })
  let completeLogin
  second.client.login = () => new Promise(resolve => { completeLogin = resolve })
  second.mount()
  await settle()
  const pending = second.store.useOpenIM()
  assert.equal(pending.session, undefined)
  assert.equal(pending.startupSnapshot.conversations[0].conversationID, 'chat-bob')
  completeLogin()
  await settle()
  assert.equal(second.store.useOpenIM().session.userID, 'me')
  assert.equal(second.store.useOpenIM().startupSnapshot, undefined)
  await second.store.logout()
  assert.equal(second.homeEntries().length, 0)
})

test('store deletion returns only after the persisted home snapshot excludes the conversation', async () => {
  const qa = harness(undefined, { conversationService: { remove: async () => {} } })
  await qa.store.login('me', 'password', { chat: 'http://test' })
  await new Promise(resolve => setTimeout(resolve, 300))
  assert.equal(JSON.parse(qa.homeEntries()[0][1]).conversations.length, 1)
  await qa.store.removeConversations(['chat-bob'])
  assert.equal(qa.store.useOpenIM().conversations.length, 0)
  assert.equal(JSON.parse(qa.homeEntries()[0][1]).conversations.length, 0)
})
