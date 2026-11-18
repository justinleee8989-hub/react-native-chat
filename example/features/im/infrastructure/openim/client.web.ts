import type { getSDK, SdkEvent } from '@openim/wasm-client-sdk'
import { platformID } from '../../config'
import type { IMClient } from '../../domain/types'
import { createWebMedia } from './media.web'
import { endWebSession } from './web-session'

type SDK = ReturnType<typeof getSDK>
type Subscription = { event: SdkEvent, listener: (response: { data: unknown }) => void }
interface WebRuntime {
  sdk?: SDK
  loading?: Promise<SDK>
  handlers: Set<Subscription>
  login?: { key: string, promise: Promise<void> }
  authenticatedKey?: string
}
// WASM and its database worker live for the page, not the Metro module lifetime.
const browserRuntime = typeof window === 'undefined' ? undefined : window as Window & { __openIMRuntime?: WebRuntime }
const state: WebRuntime = browserRuntime
  ? (browserRuntime.__openIMRuntime ??= { handlers: new Set() })
  : { handlers: new Set() }

function withTimeout<T>(operation: Promise<T>, milliseconds: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), milliseconds)
    operation.then(
      value => {
        clearTimeout(timer)
        resolve(value)
      },
      error => {
        clearTimeout(timer)
        reject(error)
      }
    )
  })
}
function loadScript (src: string, module = false) {
  return new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    const timer = setTimeout(() => {
      script.remove()
      reject(new Error(`加载超时：${src}。请检查 Web 静态资源。`))
    }, 20000)
    script.src = src
    if (module)
      script.type = 'module'
    script.onload = () => {
      clearTimeout(timer)
      resolve()
    }
    script.onerror = () => {
      clearTimeout(timer)
      script.remove()
      reject(new Error(`无法加载 ${src}`))
    }
    document.head.appendChild(script)
  })
}
function ready () {
  if (!state.loading)
    state.loading = loadScript('/wasm_exec.js')
      .then(() => loadScript('/openim-sdk-loader.js', true))
      .then(() => {
        // Keep the SDK as native browser modules so its import.meta.url resolves worker.js correctly.
        const browser = window as Window & {
          OpenIMWebSDK?: typeof import('@openim/wasm-client-sdk')
        }
        if (!browser.OpenIMWebSDK)
          throw new Error('OpenIM Web SDK 加载失败，请检查 /openim-sdk-loader.js')
        state.sdk = browser.OpenIMWebSDK.getSDK({
          coreWasmPath: '/openim.wasm',
          sqlWasmPath: '/sql-wasm.wasm',
          debug: false,
        })
        state.handlers.forEach(({ event, listener }) => state.sdk!.on(event, listener))
        return state.sdk
      })
      .catch(error => {
        state.loading = undefined
        throw error
      })
  return state.loading
}
export const client: IMClient = {
  async login(session, config) {
    const instance = await ready()
    const key = JSON.stringify([session.userID, session.imToken, platformID, config.api, config.ws])
    if (state.login) {
      if (state.login.key !== key)
        throw new Error('另一个账户正在连接，请稍后重试')
      return withTimeout(state.login.promise, 30000, '连接超时，请检查网络后重试')
    }
    const promise = (async () => {
      if (state.authenticatedKey === key && (await instance.getLoginStatus()).data === 3)
        return
      state.authenticatedKey = undefined
      await instance.login({
        userID: session.userID,
        token: session.imToken,
        platformID,
        apiAddr: config.api,
        wsAddr: config.ws,
        logLevel: 1,
        isLogStandardOutput: false,
      })
      state.authenticatedKey = key
    })()
    const attempt = { key, promise }
    state.login = attempt
    void promise.finally(() => {
      if (state.login === attempt)
        state.login = undefined
    }).catch(() => {})
    await withTimeout(
      promise,
      30000,
      'OpenIM 连接超时，请检查服务地址与 SDK worker 静态资源'
    )
  },
  async logout() {
    state.authenticatedKey = undefined
    if (state.sdk)
      await endWebSession(
        () => withTimeout(state.sdk!.logout(), 5000, 'OpenIM 退出超时'),
        () => window.location.reload()
      )
  },
  on(name, handler) {
    // The Web SDK uses capitalized enum values; native uses lower-case event names.
    const event = `${name[0].toUpperCase()}${name.slice(1)}` as SdkEvent
    const listener = (response: { data: unknown }) => handler(response.data)
    const subscription = { event, listener }
    state.handlers.add(subscription)
    state.sdk?.on(event, listener)
    return () => {
      state.handlers.delete(subscription)
      state.sdk?.off(event, listener)
    }
  },
  async conversations(offset) {
    return (await (await ready()).getConversationListSplit({ offset, count: 100 })).data
  },
  async conversation(sourceID, sessionType = 1) {
    return (await (await ready()).getOneConversation({ sourceID, sessionType })).data
  },
  async history(conversationID, startClientMsgID) {
    return (
      await (
        await ready()
      ).getAdvancedHistoryMessageList({ conversationID, startClientMsgID, count: 30, viewType: 0 })
    ).data
  },
  async createMedia(media) {
    return createWebMedia(await ready(), media)
  },
  async createLocation(location) {
    return (await (await ready()).createLocationMessage(location)).data
  },
  async createCard(card) {
    return (await (await ready()).createCardMessage(card)).data
  },
  async createText(text) {
    return (await (await ready()).createTextMessage(text)).data
  },
  async createQuote(text, message) {
    return (await (await ready()).createQuoteMessage({ text, message: JSON.stringify(message) })).data
  },
  async createForward(message) {
    return (await (await ready()).createForwardMessage(message as Parameters<SDK['createForwardMessage']>[0])).data
  },
  async revoke(conversationID, clientMsgID) {
    return (await ready()).revokeMessage({ conversationID, clientMsgID })
  },
  async search(conversationID, keyword, pageIndex) {
    const { data } = await (await ready()).searchLocalMessages({ conversationID, keywordList: [keyword], pageIndex, count: 30 })
    return { messages: data.searchResultItems?.flatMap(item => item.messageList) || [], total: data.totalCount }
  },
  async send(message, conversation) {
    const instance = await ready()
    return (
      await instance.sendMessage({
        message: message as Parameters<SDK['sendMessage']>[0]['message'],
        recvID: conversation.userID || '',
        groupID: conversation.groupID || '',
      })
    ).data
  },
  async read(conversationID) {
    return (await ready()).markConversationMessageAsRead(conversationID)
  },
}

export async function getSDKClient () {
  return ready()
}
