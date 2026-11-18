import { useEffect, useRef } from 'react'
import type { GroupMessageReadInfo, GroupMessageReadGuard, Session } from '../domain/types'
import { fetchMessageReaders } from './readers'

export function useLatestGroupReaders ({ session, chatURL, conversationID, message, readInfo, enabled, refreshToken = 0, sync, resolveSeq }: {
  session?: Session
  chatURL: string
  conversationID: string
  message?: { clientMsgID: string, seq?: number }
  readInfo?: GroupMessageReadInfo
  enabled: boolean
  refreshToken?: number
  sync: (conversationID: string, messageID: string, readCount: number, unreadCount: number, guard?: GroupMessageReadGuard) => void
  /**
   * The server seq of a message that has none locally yet. A message just sent gets its seq only
   * with the next sync, and it is the one a member is about to read: without this, its count was
   * never asked for and stayed at 0 however many read it.
   */
  resolveSeq?: (messageID: string) => Promise<number>
}) {
  const requested = useRef('')
  const inFlight = useRef(new Map<string, Promise<void>>())
  const messageID = message?.clientMsgID
  const seq = message?.seq
  useEffect(() => {
    const synced = Number.isSafeInteger(seq) && (seq || 0) > 0
    if (!enabled || !session?.chatToken || !messageID || (!synced && !resolveSeq) || (readInfo && refreshToken === 0))
      return
    const key = `${session.userID}:${session.imToken}:${session.chatToken}:${conversationID}:${messageID}:${seq}:${refreshToken}`
    const identity = `${session.userID}:${session.imToken}:${session.chatToken}:${conversationID}:${messageID}:${seq}`
    if (requested.current === key)
      return
    requested.current = key
    let current = true
    let retryTimer: ReturnType<typeof setTimeout> | undefined
    let cancelRetry: (() => void) | undefined
    const guard: GroupMessageReadGuard = { readInfo, userID: session.userID, imToken: session.imToken, chatToken: session.chatToken }
    void (async () => {
      const existing = inFlight.current.get(identity)
      if (existing)
        await existing.catch(() => {})
      if (!current)
        return
      let request: Promise<void>
      request = (async () => {
        for (let attempt = 0; attempt < 2; attempt++)
          try {
            const target = synced ? seq! : await resolveSeq!(messageID)
            if (!current)
              return
            const result = await fetchMessageReaders(session, chatURL, conversationID, messageID, target)
            if (current)
              sync(conversationID, messageID, result.readCount, result.unreadCount, guard)
            return
          } catch {
            if (attempt === 0) {
              await new Promise<void>(resolve => {
                retryTimer = setTimeout(() => {
                  retryTimer = undefined
                  cancelRetry = undefined
                  resolve()
                }, 250)
                cancelRetry = () => {
                  if (retryTimer)
                    clearTimeout(retryTimer)
                  retryTimer = undefined
                  cancelRetry = undefined
                  resolve()
                }
              })
              if (!current)
                return
            }
          }
      })()
      inFlight.current.set(identity, request)
      try {
        await request
      } finally {
        if (inFlight.current.get(identity) === request)
          inFlight.current.delete(identity)
      }
    })().catch(() => {})
    return () => {
      current = false
      cancelRetry?.()
    }
  }, [chatURL, conversationID, enabled, messageID, readInfo, refreshToken, resolveSeq, seq, session, sync])
}
