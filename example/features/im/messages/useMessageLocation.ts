import { useEffect, useRef, useState } from 'react'
import type { ChatHandle } from '@kesha-antonov/react-native-chat'
import { ensureMessageLoaded, reportError } from '../application/store'

/** Load a search hit's history before asking the official list to scroll/highlight. */
export function useMessageLocation (id: string, messageID?: string) {
  const chatRef = useRef<ChatHandle>(null)
  const [locating, setLocating] = useState(false)
  const [located, setLocated] = useState('')
  useEffect(() => {
    if (!messageID)
      return
    let active = true
    setLocating(true)
    setLocated('')
    void ensureMessageLoaded(id, messageID, () => active).then(() => {
      if (active)
        setLocated(messageID)
    }).catch(error => {
      if (active)
        reportError(error)
    }).finally(() => {
      if (active)
        setLocating(false)
    })
    return () => {
      active = false
    }
  }, [id, messageID])
  useEffect(() => {
    if (!located)
      return
    const timer = setTimeout(() => chatRef.current?.scrollToMessage(located, { animated: true, isHighlighted: true }), 250)
    return () => clearTimeout(timer)
  }, [located])

  return { chatRef, locating }
}
