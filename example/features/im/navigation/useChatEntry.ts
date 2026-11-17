import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Platform } from 'react-native'
import { type Href, useFocusEffect, useRouter } from 'expo-router'
import { prefetchConversationHistory, reportError } from '../application/store'
import { isChatEntryReady, registerChatEntryReady, waitForChatEntry } from './chat-entry'
import { describeEntryExperiments, getEntryExperiments } from './entry-experiments'
import { traceChatEntry } from './entry-performance'

/** Native preloads the actual route; Web already renders its selected pane in place. */
export function useChatEntry (account: string, open: (href: Href) => void, hasHistory: (id: string) => boolean = () => false, warmConversationID?: string) {
  const router = useRouter()
  const intent = useRef(0)
  const requested = useRef<string | undefined>(undefined)
  const committed = useRef(false)
  // Only one route is ever kept prepared off-screen: preparing another replaces it. So this holds
  // the last one only - remembering every prepared id skipped re-preparing one that had since been
  // replaced, and opening it then waited for a page that was gone (entry-failed after 1.5s).
  const prepared = useRef<string | undefined>(undefined)
  const previousAccount = useRef(account)
  const lastOpened = useRef<string | undefined>(undefined)
  const warmTarget = useRef({ account, id: warmConversationID, hasHistory })
  useLayoutEffect(() => {
    warmTarget.current = { account, id: warmConversationID, hasHistory }
  }, [account, warmConversationID, hasHistory])
  const prepare = useCallback((id: string) => {
    if (Platform.OS === 'web' || committed.current || prepared.current === id || isChatEntryReady(account, id))
      return
    traceChatEntry(account, id, 'prepare')
    prepared.current = id
    try {
      router.prefetch(`/chats/${encodeURIComponent(id)}` as Href)
    } catch {
      prepared.current = undefined
      // Speculative preparation must not disrupt scrolling or show an error.
      // The actual click retains its normal navigation/error fallback.
    }
  }, [account, router])
  useFocusEffect(useCallback(() => {
    if (Platform.OS === 'web')
      return
    // Only one automatic route per focus: prepare after the list has a chance to paint.
    const timer = setTimeout(() => {
      const target = warmTarget.current
      if (target.account !== account)
        return
      const id = lastOpened.current && target.hasHistory(lastOpened.current)
        ? lastOpened.current
        : target.id
      if (id && target.hasHistory(id))
        prepare(id)
    }, 200)
    return () => clearTimeout(timer)
  }, [account, prepare]))
  const cancel = useRef<(() => void) | undefined>(undefined)
  useFocusEffect(useCallback(() => {
    committed.current = false
    requested.current = undefined
    prepared.current = undefined
    return () => {
      intent.current++
      cancel.current?.()
      prepared.current = undefined
    }
  }, []))
  useLayoutEffect(() => {
    intent.current++
    cancel.current?.()
    if (previousAccount.current !== account) {
      committed.current = false
      requested.current = undefined
      prepared.current = undefined
      lastOpened.current = undefined
      previousAccount.current = account
    }
  }, [account])
  const openChat = (id: string) => {
    const href = `/chats/${encodeURIComponent(id)}` as Href
    if (Platform.OS === 'web') {
      void prefetchConversationHistory(id)
      open(href)
      return
    }
    if (committed.current || requested.current === id) {
      traceChatEntry(account, id, 'duplicate-ignored')
      return
    }
    requested.current = id
    lastOpened.current = id
    const current = ++intent.current
    cancel.current?.()
    const cached = hasHistory(id)
    // Cached entry must not trigger a store-wide refresh before navigation.
    // focusConversation already refreshes the actual focused page.
    const history = cached ? Promise.resolve() : prefetchConversationHistory(id)
    traceChatEntry(account, id, cached ? 'press-cached' : 'press-cold', describeEntryExperiments())
    void Promise.resolve(history).then(() => traceChatEntry(account, id, 'history-ready'))
    // Experiment: go now and let the page build while it slides in, instead of holding the list
    // until the page is laid out off-screen. History still loads in the background.
    if (getEntryExperiments().entryMode === 'navigate-now') {
      committed.current = true
      traceChatEntry(account, id, 'navigate')
      open(href)
      return
    }
    if (cached && isChatEntryReady(account, id)) {
      committed.current = true
      traceChatEntry(account, id, 'navigate')
      open(href)
      return
    }
    // Keep the pressed list visible while the real route lays out off-screen. No fake rows,
    // screenshots or new message cache; focus still owns read receipts and live subscriptions.
    void Promise.resolve().then(async () => {
      if (intent.current !== current)
        return
      // Start the real page alongside the initial SDK read, not after it.
      if (!cached) {
        prepare(id)
        await history
      }
      if (intent.current !== current)
        return
      const entry = waitForChatEntry(account, id)
      cancel.current = entry.cancel
      if (cached)
        prepare(id)
      const ready = await entry.ready
      if (intent.current !== current)
        return
      if (!ready)
        throw new Error('会话页面尚未准备完成，请再点一次重试')
      committed.current = true
      traceChatEntry(account, id, 'navigate')
      open(href)
    }).catch(error => {
      if (intent.current !== current)
        return
      cancel.current?.()
      traceChatEntry(account, id, 'entry-failed')
      requested.current = undefined
      if (prepared.current === id)
        prepared.current = undefined
      reportError(error)
    })
  }
  return { open: openChat, prepare }
}

export function useChatEntryReady (account: string, id: string, historyReady: boolean) {
  const [listReady, setListReady] = useState(false)
  const [retiring, setRetiring] = useState(false)
  const release = useRef<(() => void) | undefined>(undefined)
  useFocusEffect(useCallback(() => {
    traceChatEntry(account, id, 'focus')
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => traceChatEntry(account, id, 'focused-frame'))
    })
    setRetiring(false)
    return () => {
      // A popped screen can remain mounted throughout its native exit animation.
      // It must not vouch for a different instance being prepared behind the list.
      traceChatEntry(account, id, 'retire')
      cancelAnimationFrame(frame)
      release.current?.()
      setRetiring(true)
    }
  }, [account, id]))
  const onReady = useCallback(() => {
    traceChatEntry(account, id, 'list-ready')
    setListReady(true)
  }, [account, id])
  useEffect(() => {
    if (listReady && historyReady && !retiring) {
      const unregister = registerChatEntryReady(account, id)
      release.current = unregister
      return unregister
    }
  }, [account, id, listReady, historyReady, retiring])
  return onReady
}
