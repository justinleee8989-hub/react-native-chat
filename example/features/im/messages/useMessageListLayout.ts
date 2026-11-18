import { useCallback, useEffect, useRef, useState } from 'react'
import type { LayoutChangeEvent } from 'react-native'
import type { ChatProps, IMessage } from '@kesha-antonov/react-native-chat'
import { reportError } from '../application/store'

type MessageList = NonNullable<NonNullable<ChatProps<IMessage>['messagesContainerRef']>['current']>

/** The longest the buffer waits for the push animation to end before growing anyway. */
const BUFFER_EXPAND_FALLBACK_MS = 700

/** Reflow the virtualized rows without replacing the chat, composer or visible-item anchor. */
export function useMessageListLayout () {
  const [width, setWidth] = useState<number>()
  // The first build is only the viewport: a chat that was not prepared ahead cannot open until these
  // rows are built, and a 600px buffer built about twice the rows and opened ~190ms later on Android
  // (docs/openim/entry-perf-2026-11-18).
  const [drawDistance, setDrawDistance] = useState(0)
  const ready = useRef(false)
  const expanded = useRef(false)
  const transitionDone = useRef(false)
  const targetDistance = useRef(1000)
  const bufferFrame = useRef<number | undefined>(undefined)
  const bufferTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const expand = useCallback(() => {
    if (expanded.current)
      return
    expanded.current = true
    if (bufferTimer.current !== undefined)
      clearTimeout(bufferTimer.current)
    bufferTimer.current = undefined
    setDrawDistance(targetDistance.current)
  }, [])
  const expandInTwoFrames = useCallback(() => {
    bufferFrame.current = requestAnimationFrame(() => {
      bufferFrame.current = requestAnimationFrame(() => {
        bufferFrame.current = undefined
        expand()
      })
    })
  }, [expand])
  // The list first builds only the viewport; the full two-screen buffer is added after. Added while the page slides in, those extra rows are built in the same frames as
  // the push animation, so by default it waits for the transition to end.
  const onReady = useCallback(() => {
    if (ready.current)
      return
    ready.current = true
    if (transitionDone.current)
      expandInTwoFrames()
    else
      bufferTimer.current = setTimeout(expand, BUFFER_EXPAND_FALLBACK_MS)
  }, [expand, expandInTwoFrames])
  // The user starts scrolling: grow the buffer now, whatever the push is doing. With only the
  // viewport built, a fling during or right after the push showed an empty band for ~0.2s.
  const onScrollBeginDrag = useCallback(() => {
    if (!ready.current || expanded.current)
      return
    if (bufferFrame.current !== undefined)
      cancelAnimationFrame(bufferFrame.current)
    bufferFrame.current = undefined
    expand()
  }, [expand])
  /** The push animation that opened the page has ended. */
  const onTransitionEnd = useCallback(() => {
    transitionDone.current = true
    if (ready.current && !expanded.current && bufferFrame.current === undefined)
      expandInTwoFrames()
  }, [expandInTwoFrames])
  const messagesContainerRef = useRef<MessageList>(null!)
  const previousWidth = useRef<number | undefined>(undefined)
  const frame = useRef<number | undefined>(undefined)
  useEffect(() => () => {
    if (bufferFrame.current !== undefined)
      cancelAnimationFrame(bufferFrame.current)
    if (bufferTimer.current !== undefined)
      clearTimeout(bufferTimer.current)
    if (frame.current !== undefined)
      cancelAnimationFrame(frame.current)
  }, [])
  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const height = event.nativeEvent.layout.height
    if (Number.isFinite(height) && height > 0) {
      targetDistance.current = Math.max(600, Math.min(2400, Math.round(height * 2)))
      if (expanded.current)
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
  return { messagesContainerRef, onLayout, onReady, onTransitionEnd, onScrollBeginDrag, drawDistance, width }
}
