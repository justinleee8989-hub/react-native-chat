import type { IMClient, IMMessage, MediaInput, Conversation } from '../domain/types'
import { createAttachmentBatchManager } from '../messages/attachment-batch'
import type { MessageExtra } from '../messages/extras'
import { projectMessage, searchableText, sdkMessageWithProjection } from '../messages/projection'
import type { Runtime } from './runtime'

export interface MessageProjectionService {
  load: (conversationID: string, messageIDs: string[]) => Promise<Record<string, MessageExtra>>
}
const SEARCH_PAGE_SIZE = 30
const SEARCH_MAX_PAGES = 10000
function compareMessagesNewestFirst (a: IMMessage, b: IMMessage) {
  if (a.seq !== undefined && b.seq !== undefined && a.seq !== b.seq)
    return b.seq - a.seq
  return (b.sendTime || b.createTime || 0) - (a.sendTime || a.createTime || 0) || b.clientMsgID.localeCompare(a.clientMsgID)
}

export function createMessaging (runtime: Runtime, client: IMClient, beforeRetry?: (message: IMMessage) => Promise<void>, projection?: MessageProjectionService) {
  const historyPending = new Set<string>()
  const historyWaiters = new Map<string, Set<(failed: boolean, error?: unknown) => void>>()
  const sending = new Set<string>()
  const attachmentBatches = createAttachmentBatchManager({
    getEpoch: () => runtime.generation,
    createMedia: media => client.createMedia(media),
    createText: text => client.createText(text),
    send: (id, message) => sendPreparedChecked(id, message),
  })
  async function refresh () {
    const epoch = runtime.generation
    let offset = 0
    let page: Conversation[]
    let projectionUnavailable = false
    do {
      page = await client.conversations(offset)
      if (epoch !== runtime.generation)
        return
      if (projection && page.length)
        page = await Promise.all(page.map(async conversation => {
          let latest: IMMessage | undefined
          try {
            latest = conversation.latestMsg ? JSON.parse(conversation.latestMsg) as IMMessage : undefined
          } catch { /* Invalid previews are left as provided by the SDK. */ }
          if (!latest || latest.status !== 2 || latest.contentType >= 1000)
            return conversation
          try {
            const extra = (await projection.load(conversation.conversationID, [latest.clientMsgID]))[latest.clientMsgID]
            if (epoch !== runtime.generation)
              return conversation
            const projected = projectMessage(latest, extra)
            if (projected.projection)
              return { ...conversation, latestMsg: JSON.stringify(projected) }
          } catch {
            projectionUnavailable = true
            const previous = runtime.state.conversations.find(item => item.conversationID === conversation.conversationID)
            try {
              const previousLatest = previous?.latestMsg ? JSON.parse(previous.latestMsg) as IMMessage : undefined
              if (previousLatest?.clientMsgID === latest?.clientMsgID && previousLatest.projection)
                return { ...conversation, latestMsg: previous!.latestMsg }
            } catch { /* Keep the SDK preview if the previous preview cannot be parsed. */ }
          }
          return conversation
        }))
      if (epoch !== runtime.generation)
        return
      runtime.mergeConversations(page)
      offset += page.length
    } while (page.length === 100)
    const projectionWarning = projectionUnavailable ? '部分会话的编辑信息暂时无法同步，请稍后刷新' : undefined
    if (projectionWarning && epoch === runtime.generation)
      runtime.reportError(new Error(projectionWarning))
    return { projectionWarning }
  }
  async function openConversation (userID: string, sessionType = 1) {
    const epoch = runtime.generation
    const conversation = await client.conversation(userID.trim(), sessionType)
    if (epoch !== runtime.generation)
      throw new Error('登录已改变，请重试')
    runtime.mergeConversations([conversation])
    return conversation.conversationID
  }
  async function loadHistory (id: string, earlier = false) {
    const revision = runtime.historyRevision?.[id] || 0
    const key = `${runtime.generation}:${revision}:${id}`
    if (historyPending.has(key))
      return new Promise<void>((resolve, reject) => {
        const waiters = historyWaiters.get(key) || new Set<(failed: boolean, error?: unknown) => void>()
        waiters.add((failed, error) => failed ? reject(error) : resolve())
        historyWaiters.set(key, waiters)
      })
    historyPending.add(key)
    const epoch = runtime.generation
    const messages = runtime.state.messages[id] || []
    let failure: unknown
    try {
      const result = await client.history(
        id,
        earlier ? [...messages].sort(compareMessagesNewestFirst).at(-1)?.clientMsgID || '' : ''
      )
      if (epoch === runtime.generation && revision === (runtime.historyRevision?.[id] || 0)) {
        runtime.addMessages(id, result.messageList || [])
        runtime.update({
          historyEnd: {
            ...runtime.state.historyEnd,
            [id]: result.isEnd || !result.messageList?.length,
          },
        })
      }
    } catch (error) {
      failure = error
      throw error
    } finally {
      historyPending.delete(key)
      historyWaiters.get(key)?.forEach(settle => settle(failure !== undefined, failure))
      historyWaiters.delete(key)
    }
  }
  async function ensureMessageLoaded (id: string, messageID: string) {
    const epoch = runtime.generation
    const seen = new Set<string>()
    let reachedEnd = false
    for (let page = 0; page < SEARCH_MAX_PAGES; page++) {
      if (epoch !== runtime.generation)
        throw new Error('登录已改变，请重新打开消息')
      if ((runtime.state.messages[id] || []).some(message => message.clientMsgID === messageID))
        return
      const before = runtime.state.messages[id] || []
      const beforeCursor = [...before].sort(compareMessagesNewestFirst).at(-1)?.clientMsgID || ''
      if (runtime.state.historyEnd?.[id]) {
        reachedEnd = true
        break
      }
      const startCursor = beforeCursor
      const requestKey = `${epoch}:${runtime.historyRevision?.[id] || 0}:${id}`
      await loadHistory(id, beforeCursor !== '')
      if (epoch !== runtime.generation)
        throw new Error('登录已改变，请重新打开消息')
      if ((runtime.state.messages[id] || []).some(message => message.clientMsgID === messageID))
        return
      const after = runtime.state.messages[id] || []
      const afterCursor = [...after].sort(compareMessagesNewestFirst).at(-1)?.clientMsgID || ''
      if (runtime.state.historyEnd?.[id] || !after.length) {
        reachedEnd = true
        break
      }
      if ((startCursor && afterCursor === startCursor) || seen.has(`${requestKey}:${afterCursor}`))
        throw new Error('本地历史分页游标未前进，无法定位该消息')
      seen.add(`${requestKey}:${afterCursor}`)
    }
    if (!reachedEnd)
      throw new Error('本地同步记录过多，定位扫描达到安全上限；请先加载更多历史')
    throw new Error('未能在本机同步记录中找到该消息')
  }
  function focusConversation (id: string) {
    const epoch = runtime.generation
    const reportCurrentError = (error: unknown) => {
      if (epoch === runtime.generation)
        runtime.reportError(error)
    }
    runtime.activeID = id
    void loadHistory(id).catch(reportCurrentError)
    const conversation = runtime.state.conversations.find(item => item.conversationID === id)
    if (conversation?.latestMsg || conversation?.unreadCount || runtime.state.messages[id]?.length)
      void client.read(id).catch(reportCurrentError)
    return () => {
      if (runtime.activeID === id)
        runtime.activeID = ''
    }
  }
  async function sendText (id: string, text: string) {
    const conversation = runtime.state.conversations.find(item => item.conversationID === id)
    if (!conversation || !runtime.state.session || !text.trim())
      return
    const epoch = runtime.generation
    const message = await client.createText(text)
    if (epoch !== runtime.generation)
      return
    await retryMessage(id, message)
  }
  async function sendTextChecked (id: string, text: string) {
    if (!text.trim())
      throw new Error('消息不能为空')
    const epoch = runtime.generation
    const message = await client.createText(text)
    if (epoch !== runtime.generation)
      throw new Error('登录已改变，请重新发送')
    await sendPreparedChecked(id, message)
  }
  async function sendPreparedChecked (id: string, message: IMMessage) {
    const conversation = runtime.state.conversations.find(item => item.conversationID === id)
    if (!conversation || !runtime.state.session)
      throw new Error('会话或登录状态已失效')
    if (runtime.state.messages[id]?.some(item => item.clientMsgID === message.clientMsgID && item.status === 2))
      return
    const epoch = runtime.generation
    if (sending.has(message.clientMsgID))
      throw new Error('消息正在发送，请稍后重试')
    sending.add(message.clientMsgID)
    try {
      if (beforeRetry)
        await beforeRetry(message)
      if (epoch !== runtime.generation)
        throw new Error('登录已改变，请重新发送')
      runtime.addMessages(id, [{ ...message, status: 1 }])
      const sent = await client.send(message, conversation)
      if (epoch !== runtime.generation)
        throw new Error('登录已改变，请重新发送')
      runtime.addMessages(id, [sent])
    } catch (error) {
      if (epoch === runtime.generation)
        runtime.addMessages(id, [{ ...message, status: 3 }])
      throw error
    } finally {
      sending.delete(message.clientMsgID)
    }
  }
  async function sendQuote (id: string, text: string, sourceID: string) {
    const source = runtime.state.messages[id]?.find(item => item.clientMsgID === sourceID)
    if (!source || source.contentType === 2101)
      throw new Error('引用消息已不可用，请取消回复后重试')
    if (!runtime.state.session || !text.trim())
      throw new Error('登录状态已失效或消息为空')
    const epoch = runtime.generation
    const extra = projection ? (await projection.load(id, [sourceID]))[sourceID] : source.projection
    if (epoch !== runtime.generation)
      throw new Error('登录已改变，请重新发送')
    const message = await client.createQuote(text, sdkMessageWithProjection(source, extra))
    if (epoch !== runtime.generation)
      throw new Error('登录已改变，请重新发送')
    await sendPreparedChecked(id, message)
  }
  async function forwardMessage (id: string, source: IMMessage) {
    if (!runtime.state.session || source.status !== 2 || source.contentType >= 1000)
      throw new Error('此消息不能转发')
    const epoch = runtime.generation
    const storedSource = Object.values(runtime.state.messages).flat().find(item => item.clientMsgID === source.clientMsgID) || source
    const sourceConversation = Object.entries(runtime.state.messages).find(([, messages]) => messages.some(item => item.clientMsgID === source.clientMsgID))?.[0]
    const extra = projection && sourceConversation ? (await projection.load(sourceConversation, [source.clientMsgID]))[source.clientMsgID] : storedSource.projection
    if (epoch !== runtime.generation)
      throw new Error('登录已改变，请重试')
    const message = await client.createForward(sdkMessageWithProjection(storedSource, extra))
    if (epoch !== runtime.generation)
      throw new Error('登录已改变，请重试')
    await retryMessage(id, message)
    if (runtime.state.messages[id]?.find(item => item.clientMsgID === message.clientMsgID)?.status !== 2)
      throw new Error('转发失败，可到目标会话重试失败消息')
  }
  async function revokeMessage (id: string, messageID: string) {
    const source = runtime.state.messages[id]?.find(item => item.clientMsgID === messageID)
    if (!source || source.sendID !== runtime.state.session?.userID || source.status !== 2)
      throw new Error('只能撤回自己已发送的消息')
    const epoch = runtime.generation
    const revision = runtime.historyRevision?.[id] || 0
    await client.revoke(id, messageID)
    if (epoch === runtime.generation && revision === (runtime.historyRevision?.[id] || 0))
      runtime.addMessages(id, [{ ...source, contentType: 2101,
        notificationElem: { detail: JSON.stringify({ revokerNickname: '你' }) } }])
  }
  async function searchMessages (id: string, keyword: string, page = 1) {
    if (!runtime.state.session || !keyword.trim())
      return { messages: [], total: 0 }
    const epoch = runtime.generation
    const normalized = keyword.trim().toLocaleLowerCase()
    const byID = new Map<string, IMMessage>()
    const visitedCursors = new Set<string>()
    let cursor = ''
    let reachedEnd = false
    for (let index = 0; index < SEARCH_MAX_PAGES; index++) {
      const result = await client.history(id, cursor)
      if (epoch !== runtime.generation)
        throw new Error('登录已改变，请重新搜索')
      const batch = result.messageList || []
      for (const message of batch)
        if (message.clientMsgID)
          byID.set(message.clientMsgID, { ...byID.get(message.clientMsgID), ...message })
      if (result.isEnd || batch.length === 0) {
        reachedEnd = true
        break
      }
      const ordered = [...batch].sort(compareMessagesNewestFirst)
      const next = ordered[ordered.length - 1]?.clientMsgID
      if (!next || next === cursor || visitedCursors.has(next))
        throw new Error('本地历史分页游标未前进，搜索已中止')
      visitedCursors.add(next)
      cursor = next
    }
    if (!reachedEnd)
      throw new Error('本地同步记录过多，搜索扫描达到安全上限；缩小范围后重试')
    const candidates = [...byID.values()]
    const eligible = candidates.filter(message => message.status === 2 && message.contentType < 1000)
    const projectionIDs = eligible.flatMap(message => [message.clientMsgID, ...(message.quoteElem?.quoteMessage?.clientMsgID ? [message.quoteElem.quoteMessage.clientMsgID] : [])])
    const extras: Record<string, MessageExtra> = projection && projectionIDs.length
      ? await projection.load(id, projectionIDs)
      : {}
    if (epoch !== runtime.generation)
      throw new Error('登录已改变，请重新搜索')
    const matches = candidates.map(message => projectMessage(message, extras[message.clientMsgID], extras))
      .filter(message => searchableText(message).toLocaleLowerCase().includes(normalized))
      .sort((a, b) => b.sendTime - a.sendTime || b.clientMsgID.localeCompare(a.clientMsgID))
    const start = (Math.max(1, Math.floor(page)) - 1) * SEARCH_PAGE_SIZE
    return { messages: matches.slice(start, start + SEARCH_PAGE_SIZE), total: matches.length }
  }
  async function sendMedia (id: string, media: MediaInput) {
    // The official recorder releases its take at submit; retain audio before SDK creation.
    if (media.type === 'audio')
      return sendAttachmentBatchChecked(id, [media])
    if (
      !runtime.state.session ||
      !runtime.state.conversations.some(item => item.conversationID === id)
    )
      throw new Error('会话或登录状态已失效')
    const epoch = runtime.generation
    const message = await client.createMedia(media)
    if (epoch !== runtime.generation)
      throw new Error('登录已改变，请重新发送')
    return sendPreparedChecked(id, message)
  }
  async function sendAttachmentBatchChecked (id: string, media: MediaInput[], caption = '') {
    const batch = createAttachmentBatch(id, media, caption)
    await runAttachmentBatch(batch.id)
  }
  function createAttachmentBatch (id: string, media: MediaInput[], caption = '') {
    if (!runtime.state.session || !runtime.state.conversations.some(item => item.conversationID === id))
      throw new Error('会话或登录状态已失效')
    return attachmentBatches.create(id, media, caption)
  }
  function getAttachmentBatch (batchID: string) {
    const batch = attachmentBatches.get(batchID)
    return batch?.epoch === runtime.generation ? batch : undefined
  }
  function listAttachmentBatches () {
    return attachmentBatches.list()
  }
  async function runAttachmentBatch (batchID: string) {
    return attachmentBatches.run(batchID)
  }
  function cancelAttachmentBatch (batchID: string) {
    return attachmentBatches.cancel(batchID)
  }
  async function retryMessage (id: string, message: IMMessage) {
    const conversation = runtime.state.conversations.find(item => item.conversationID === id)
    if (!conversation || sending.has(message.clientMsgID))
      return
    const epoch = runtime.generation
    sending.add(message.clientMsgID)
    try {
      if (beforeRetry)
        await beforeRetry(message)
      if (epoch !== runtime.generation)
        return
      runtime.addMessages(id, [{ ...message, status: 1, uploadProgress: undefined }])
      const sent = await client.send(message, conversation)
      if (epoch === runtime.generation)
        runtime.addMessages(id, [sent])
    } catch (error) {
      if (epoch === runtime.generation) {
        runtime.addMessages(id, [{ ...message, status: 3 }])
        runtime.reportError(error)
      }
    } finally {
      sending.delete(message.clientMsgID)
    }
  }

  return {
    refresh,
    openConversation,
    loadHistory,
    focusConversation,
    sendText,
    sendTextChecked,
    sendPreparedChecked,
    sendQuote,
    forwardMessage,
    revokeMessage,
    searchMessages,
    sendMedia,
    sendAttachmentBatchChecked,
    createAttachmentBatch,
    getAttachmentBatch,
    listAttachmentBatches,
    runAttachmentBatch,
    cancelAttachmentBatch,
    subscribeAttachmentBatches: attachmentBatches.subscribe,
    getAttachmentBatchesSnapshot: attachmentBatches.getSnapshot,
    ensureMessageLoaded,
    retryMessage,
    reset: () => {
      historyPending.clear()
      sending.clear()
      attachmentBatches.reset()
    },
  }
}
export type Messaging = ReturnType<typeof createMessaging>
