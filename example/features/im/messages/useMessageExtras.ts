import { useCallback, useEffect, useRef, useState } from 'react'
import type { IMessage } from '@kesha-antonov/react-native-chat'
import { refresh, reportError, useOpenIM } from '../application/store'
import { parseCallInvitation } from '../calls/invitation'
import type { IMMessage } from '../domain/types'
import { applyExtras, batchMessageIDs, mergeMessageExtras, messageExtras } from './extras'
import type { MessageExtra } from './extras'
export function useMessageExtras (conversationID: string, messages: IMMessage[]) {
  const { session, config } = useOpenIM()
  const [records, setRecords] = useState<Record<string, MessageExtra>>({})
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
      throw new Error('消息正在保存或登录已失效，请稍后重试')
    const raw = messages.find(m => m.clientMsgID === message._id)
    if (!raw || raw.status !== 2 || raw.contentType >= 1000 || parseCallInvitation(raw.textElem?.content || ''))
      throw new Error('这条消息当前无法修改')
    const id = raw.clientMsgID
    pending.current.add(id)
    try {
      const changed = await messageExtras(session, config.chat, { action, conversationID, messageID: id, seq: raw.seq,
        text: action === 'edit' ? value : undefined, emoji: action === 'react' ? value : undefined,
        enabled: !records[id]?.reactions?.[value]?.[session.userID], revision: records[id]?.revision || 0 })
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
  return { map: (message: IMessage) => {
    const projected = applyExtras(message, records[String(message._id)])
    return projected.replyMessage ? { ...projected, replyMessage: applyExtras(projected.replyMessage as IMessage, records[String(projected.replyMessage._id)]) } : projected
  },
  edit: (message: IMessage, text: string) => mutate(message, 'edit', text),
  react: (message: IMessage, emoji: string) => {
    void mutate(message, 'react', emoji).catch(() => {}) 
  } }
}
