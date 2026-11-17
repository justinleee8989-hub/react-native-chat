import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChatHandle } from '@kesha-antonov/react-native-chat'
import { ensureMessageLoaded, reportError } from '../application/store'

/** Load a search hit's history before asking the official list to scroll/highlight. */
export function useMessageLocation (id: string, messageID?: string) {
  const chatRef = useRef<ChatHandle>(null)
  const [locating, setLocating] = useState(false)
  const [request, setRequest] = useState<{ messageID: string }>()
  const [located, setLocated] = useState<{ messageID: string }>()
  const requestLocation = useCallback((target: string) => setRequest({ messageID: target }), [])
  useEffect(() => {
    const target = request?.messageID || messageID
    if (!target)
      return
    let active = true
    setLocating(true)
    setLocated(undefined)
    void ensureMessageLoaded(id, target, () => active).then(() => {
      if (active)
        setLocated({ messageID: target })
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
  }, [id, messageID, request])
  useEffect(() => {
    if (!located)
      return
    const timer = setTimeout(() => chatRef.current?.scrollToMessage(located.messageID, { animated: true, isHighlighted: true }), 250)
    return () => clearTimeout(timer)
  }, [located])

  return { chatRef, locating, requestLocation }
}
