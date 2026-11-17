import { useCallback, useEffect, useRef, useState } from 'react'
import type { LayoutChangeEvent } from 'react-native'
import type { ChatProps, IMessage } from '@kesha-antonov/react-native-chat'
import { reportError } from '../application/store'

type MessageList = NonNullable<NonNullable<ChatProps<IMessage>['messagesContainerRef']>['current']>

/** Reflow the virtualized rows without replacing the chat, composer or visible-item anchor. */
export function useMessageListLayout () {
  const [width, setWidth] = useState<number>()
  const [drawDistance, setDrawDistance] = useState(600)
  const ready = useRef(false)
  const targetDistance = useRef(1000)
  const bufferFrame = useRef<number | undefined>(undefined)
  const onReady = useCallback(() => {
    if (ready.current)
      return
    ready.current = true
    bufferFrame.current = requestAnimationFrame(() => {
      bufferFrame.current = requestAnimationFrame(() => {
        bufferFrame.current = undefined
        setDrawDistance(targetDistance.current)
      })
    })
  }, [])
  const messagesContainerRef = useRef<MessageList>(null!)
  const previousWidth = useRef<number | undefined>(undefined)
  const frame = useRef<number | undefined>(undefined)
  useEffect(() => () => {
    if (bufferFrame.current !== undefined)
      cancelAnimationFrame(bufferFrame.current)
    if (frame.current !== undefined)
      cancelAnimationFrame(frame.current)
  }, [])
  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const height = event.nativeEvent.layout.height
    if (Number.isFinite(height) && height > 0) {
      targetDistance.current = Math.max(600, Math.min(2400, Math.round(height * 2)))
      if (ready.current && bufferFrame.current === undefined)
        setDrawDistance(targetDistance.current)
    }
    const width = event.nativeEvent.layout.width
    if (!Number.isFinite(width) || width <= 0 || previousWidth.current === width)
      return
    const initialized = previousWidth.current !== undefined
    previousWidth.current = width
    setWidth(width)
    if (!initialized)
      return
    if (frame.current !== undefined)
      cancelAnimationFrame(frame.current)
    // Product bubbles apply their measured width on the next render. Clear after that
    // layout, rather than caching the temporary heights from the old desktop width.
    frame.current = requestAnimationFrame(() => {
      frame.current = requestAnimationFrame(() => {
        frame.current = undefined
        try {
          messagesContainerRef.current?.clearCaches({ mode: 'sizes' })
        } catch (error) {
          reportError(error)
        }
      })
    })
  }, [])
  return { messagesContainerRef, onLayout, onReady, drawDistance, width }
}
