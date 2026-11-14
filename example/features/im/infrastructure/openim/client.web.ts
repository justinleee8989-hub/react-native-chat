import type { getSDK, SdkEvent } from '@openim/wasm-client-sdk'
import { platformID } from '../../config'
import type { IMClient } from '../../domain/types'
import { createWebMedia } from './media.web'
import { endWebSession } from './web-session'

type SDK = ReturnType<typeof getSDK>
let sdk: SDK | undefined
let loading: Promise<SDK> | undefined
const handlers = new Set<{ event: SdkEvent, listener: (response: { data: unknown }) => void }>()
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
  if (!loading)
    loading = loadScript('/wasm_exec.js')
      .then(() => loadScript('/openim-sdk-loader.js', true))
      .then(() => {
        // Keep the SDK as native browser modules so its import.meta.url resolves worker.js correctly.
        const browser = window as Window & {
          OpenIMWebSDK?: typeof import('@openim/wasm-client-sdk')
        }
        if (!browser.OpenIMWebSDK)
          throw new Error('OpenIM Web SDK 加载失败，请检查 /openim-sdk-loader.js')
        sdk = browser.OpenIMWebSDK.getSDK({
          coreWasmPath: '/openim.wasm',
          sqlWasmPath: '/sql-wasm.wasm',
          debug: false,
        })
        handlers.forEach(({ event, listener }) => sdk!.on(event, listener))
        return sdk
      })
      .catch(error => {
        loading = undefined
        throw error
      })
  return loading
}
export const client: IMClient = {
  async login(session, config) {
    const instance = await ready()
    await withTimeout(
      instance.login({
        userID: session.userID,
        token: session.imToken,
        platformID,
        apiAddr: config.api,
        wsAddr: config.ws,
        logLevel: 1,
      }),
      30000,
      'OpenIM 连接超时，请检查服务地址与 SDK worker 静态资源'
    )
  },
  async logout() {
    if (sdk)
      await endWebSession(
        () => withTimeout(sdk!.logout(), 5000, 'OpenIM 退出超时'),
        () => window.location.reload()
      )
  },
  on(name, handler) {
    // The Web SDK uses capitalized enum values; native uses lower-case event names.
    const event = `${name[0].toUpperCase()}${name.slice(1)}` as SdkEvent
    const listener = (response: { data: unknown }) => handler(response.data)
    const subscription = { event, listener }
    handlers.add(subscription)
    sdk?.on(event, listener)
    return () => {
      handlers.delete(subscription)
      sdk?.off(event, listener)
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
