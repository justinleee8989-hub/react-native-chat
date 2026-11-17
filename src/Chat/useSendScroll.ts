import { RefObject, useCallback, useEffect, useRef } from 'react'

import { AnimatedList } from '../MessagesContainer'
import { IMessage } from '../Models'

/** Follow a committed outgoing row, not a timer racing an async transport. */
export function useSendScroll<TMessage extends IMessage> (
  messages: TMessage[] | undefined,
  userID: string | number | undefined,
  listRef: RefObject<AnimatedList | null>
) {
  const pending = useRef<Set<string | number> | null>(null)
  const request = useCallback(() => {
    pending.current = new Set((messages || []).map(message => message._id))
  }, [messages])
  useEffect(() => {
    const previous = pending.current
    if (!previous || !messages?.some(message => message.user._id === userID && !previous.has(message._id)))
      return
    pending.current = null
    // LegendList queues this until its commit and corrects estimated sizes, including offscreen
    // rows and the footer. An immediate follow avoids competing scroll animations on send.
    listRef.current?.scrollToEnd({ animated: false })
  }, [listRef, messages, userID])
  return request
}
