import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { IMessage } from '@kesha-antonov/react-native-chat'
import { refresh, reportError, useOpenIM, loadServerHistory } from '../application/store'
import { parseCallInvitation } from '../calls/invitation'
import type { IMMessage } from '../domain/types'
import { ProductError } from '../shared/product-error.ts'
import { applyExtras, batchMessageIDs, mergeMessageExtras, messageExtras, resolveExtraSequence } from './extras'
import type { MessageExtra } from './extras'
export function useMessageExtras (conversationID: string, messages: IMMessage[]) {
  const { session, config } = useOpenIM()
  const [records, setRecords] = useState<Record<string, MessageExtra>>({})
  const activeContext = useRef({ session, conversationID })
  // Written after render, not during it: a ref write in the render body makes React Compiler skip
  // this hook, and then `map` below was a new function on every render of the chat page.
  useLayoutEffect(() => {
    activeContext.current = { session, conversationID }
  }, [session, conversationID])
  const mounted = useRef(true)
  const pending = useRef(new Set<string>())
  const ids = messages.filter(m => m.status === 2 && m.contentType < 1000).flatMap(m => [m.clientMsgID, ...(m.quoteElem?.quoteMessage?.clientMsgID ? [m.quoteElem.quoteMessage.clientMsgID] : [])]).join(',')
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  useEffect(() => {
    let active = true; let loading = false
    const refresh = async () => {
      if (!session || !ids || loading)
        return
      loading = true
      try {
        for (const batch of batchMessageIDs(ids.split(','))) {
          if (!active)
            break
          const found = await messageExtras(session, config.chat, { action: 'get', conversationID, messageIDs: batch })
          if (active)
            setRecords(previous => mergeMessageExtras(previous, found))
        }
      } catch { /* Mutations surface errors; background polls retry after a transient outage. */ } finally {
        loading = false
      }
    }
    void refresh()
    const timer = setInterval(refresh, 2500)
    return () => {
      active = false; clearInterval(timer)
    }
  }, [session, config.chat, conversationID, ids])
  const mutate = useCallback(async (message: IMessage, action: 'edit' | 'react', value: string) => {
    if (!session || pending.current.has(String(message._id)))
      throw new ProductError('extras.saving')
    const raw = messages.find(m => m.clientMsgID === message._id)
    if (!raw || raw.status !== 2 || raw.contentType >= 1000 || parseCallInvitation(raw.textElem?.content || ''))
      throw new ProductError('extras.cantEdit')
    const id = raw.clientMsgID
    pending.current.add(id)
    try {
      const assertCurrent = () => {
        if (!mounted.current || activeContext.current.session !== session || activeContext.current.conversationID !== conversationID)
          throw new ProductError('history.signInChanged')
      }
      const seq = await resolveExtraSequence(raw, async cursor => {
        assertCurrent()
        return loadServerHistory({ conversationID, cursor })
      })
      assertCurrent()
      const changed = await messageExtras(session, config.chat, { action, conversationID, messageID: id, seq,
        text: action === 'edit' ? value : undefined, emoji: action === 'react' ? value : undefined,
        enabled: !records[id]?.reactions?.[value]?.[session.userID], revision: records[id]?.revision || 0 })
      assertCurrent()
      if (mounted.current) {
        setRecords(previous => mergeMessageExtras(previous, changed))
        void refresh().catch(reportError)
      }
    } catch (error) {
      if (mounted.current)
        reportError(error)
      throw error
    } finally {
      pending.current.delete(id)
    }
  }, [session, config.chat, conversationID, messages, records])
  // `map` changes only with the extras themselves, so the chat page can keep its projected
  // messages (and the rows that show them) across renders that change nothing in them.
  const map = useCallback((message: IMessage) => {
    const projected = applyExtras(message, records[String(message._id)])
    return projected.replyMessage ? { ...projected, replyMessage: applyExtras(projected.replyMessage as IMessage, records[String(projected.replyMessage._id)]) } : projected
  }, [records])
  return useMemo(() => ({
    map,
    edit: (message: IMessage, text: string) => mutate(message, 'edit', text),
    react: (message: IMessage, emoji: string) => {
      void mutate(message, 'react', emoji).catch(() => {})
    },
  }), [map, mutate])
}
