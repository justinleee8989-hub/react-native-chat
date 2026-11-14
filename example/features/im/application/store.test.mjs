import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import * as model from '../domain/model.ts'

const conversation = { conversationID: 'chat-bob', userID: 'bob', showName: 'Bob', unreadCount: 0 }
const message = { clientMsgID: 'offline-1', sendID: 'bob', recvID: 'me', sendTime: 123, status: 2, contentType: 101, textElem: { content: 'While offline' } }
const settle = () => new Promise(resolve => setImmediate(resolve))
function harness (loginResponse = async () => ({ data: { userID: 'me', imToken: 'test-only', chatToken: 'chat-only' } }), options = {}) {
  const effects = []
  let savedSession = null
  let removeCount = 0
  const storage = {
    getItem: async () => savedSession,
    setItem: async (_key, value) => { savedSession = value },
    removeItem: async () => { savedSession = null; removeCount++ },
  }
  const events = new Map()
  let history = []
  let historyCalls = 0
  const client = {
    login: async () => {}, logout: async () => {}, read: async () => {},
    on: (event, handler) => { events.set(event, handler); return () => events.delete(event) },
    conversations: async () => options.conversations || [conversation],
    history: async () => { historyCalls++; return { messageList: history, isEnd: true } },
  }
  const modules = new Map()
  function load (url) {
    if (modules.has(url.href)) return modules.get(url.href)
    const module = { exports: {} }
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
        if (name.endsWith('/openim/conversation-client')) return { conversationService: {} }
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
  const store = load(new URL('./store.ts', import.meta.url))
  return { store, client, events, storage, savedSession: () => savedSession, removeCount: () => removeCount,
    mount: () => { store.useOpenIM(); effects.shift()() }, setHistory: value => { history = value }, historyCalls: () => historyCalls }
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
  assert.equal(state.recoveryAvailable, true)
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
  assert.equal(after.recoveryAvailable, before.recoveryAvailable)
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

test('temporary SDK login failure preserves saved login and can be retried', async () => {
  const h = harness()
  let attempts = 0
  h.client.login = async () => { if (++attempts === 1) throw new Error('connection refused') }
  await h.store.login('me', 'password', { chat: 'http://test' })
  assert.equal(h.store.useOpenIM().session, undefined)
  assert.equal(h.store.useOpenIM().recoveryAvailable, true)
  assert.match(h.store.useOpenIM().error, /登录信息已保留/)
  assert.ok(h.savedSession())
  assert.equal(h.removeCount(), 0)
  await h.store.retryRestore()
  assert.equal(h.store.useOpenIM().session.userID, 'me')
  assert.equal(h.store.useOpenIM().recoveryAvailable, false)
  assert.equal(h.removeCount(), 0)
})

test('explicit expired or invalid OpenIM login tokens clear saved credentials', async () => {
  const h = harness()
  let logouts = 0
  h.client.login = async () => { throw Object.assign(new Error('token rejected'), { code: '1502' }) }
  h.client.logout = async () => { logouts++ }
  await h.store.login('me', 'password', { chat: 'http://test' })
  assert.equal(h.store.useOpenIM().session, undefined)
  assert.equal(h.store.useOpenIM().recoveryAvailable, false)
  assert.equal(h.savedSession(), null)
  assert.equal(h.removeCount(), 1)
  assert.equal(logouts, 1)
  assert.match(h.store.useOpenIM().error, /凭据已失效/)
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
  assert.equal(h.store.useOpenIM().recoveryAvailable, true)
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
  assert.equal(h.store.useOpenIM().recoveryAvailable, false)
})

test('explicit invalid-token event clears saved login', async () => {
  const h = harness()
  await h.store.login('me', 'password', { chat: 'http://test' })
  assert.ok(h.savedSession())
  h.events.get('onUserTokenInvalid')()
  await settle()
  assert.equal(h.store.useOpenIM().session, undefined)
  assert.equal(h.store.useOpenIM().recoveryAvailable, false)
  assert.equal(h.savedSession(), null)
  assert.equal(h.removeCount(), 1)
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


test('session initialization waits for storage before allowing an unauthenticated redirect', async () => {
  const h = harness()
  let finishRead
  h.storage.getItem = () => new Promise(resolve => { finishRead = resolve })
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

test('session initialization completes after storage failure so recovery is accessible', async () => {
  const h = harness()
  h.storage.getItem = async () => { throw new Error('storage unavailable') }
  h.mount()
  await settle()
  assert.equal(h.store.useOpenIM().initialized, true)
  assert.equal(h.store.useOpenIM().busy, false)
  assert.equal(h.store.useOpenIM().recoveryAvailable, true)
})
