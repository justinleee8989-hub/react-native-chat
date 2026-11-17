import React from 'react'
import { Platform, StyleProp, StyleSheet, View, ViewStyle } from 'react-native'
import { GestureDetector, MouseButton, useExclusiveGestures, useLongPressGesture, useTapGesture } from 'react-native-gesture-handler'
import Animated, { AnimatedRef, runOnJS } from 'react-native-reanimated'

import { PRESS_HOLD_MS } from '../components/messagePress'
import { IMessage } from '../Models'

/** The original bubble while the long-press overlay shows its lifted copy. */
export const hiddenStyle: ViewStyle = { opacity: 0 }

export type PressableBubbleRowProps<TMessage extends IMessage> = {
  isContextMenuEnabled?: boolean
  isGestureEnabled: boolean
  /** The overlay is showing a lifted copy, so the original is hidden. */
  isLifted?: boolean
  onPressMessage?: (context: unknown, message: TMessage) => void
  /** The long-press fired; the finger's window coordinates, when known. */
  onLongPressStart: (touchX?: number, touchY?: number) => void
  measureBubble: () => void
  context: unknown
  currentMessage: TMessage
  rowSurfaceStyle: StyleProp<ViewStyle>
  wrapperStyleList: StyleProp<ViewStyle>
  bubbleContainerRef: AnimatedRef<Animated.View>
  children: React.ReactNode
}

/**
 * The message row as it behaves when a long-press can open something - the reactions picker or the
 * context menu. It owns the press-scale shared value, the animated style over it and the gesture
 * composition, so none of that exists on a row that has neither feature enabled.
 *
 * Those hooks used to sit in `Bubble` itself, where they had to run unconditionally to keep hook
 * order stable, even though the `Animated.View` reading them only renders on this path. That put a
 * shared value and a UI-thread worklet on every message in the conversation for a scale animation
 * most of them could never play.
 */
export const PressableBubbleRow = <TMessage extends IMessage>({
  isContextMenuEnabled = false,
  isGestureEnabled,
  isLifted = false,
  onPressMessage,
  onLongPressStart,
  measureBubble,
  context,
  currentMessage,
  rowSurfaceStyle,
  wrapperStyleList,
  bubbleContainerRef,
  children,
}: PressableBubbleRowProps<TMessage>) => {
  const tapGesture = useTapGesture({
    // Only attached when there is something to call - otherwise it would
    // compete with interactive content inside the bubble for no reason.
    enabled: !!onPressMessage,
    // Keep native subviews (video controls, maps, native buttons) receiving
    // touches. iOS cancels them by default the moment this recognizer wins.
    cancelsTouchesInView: false,
    runOnJS: true,
    onDeactivate: event => {
      if (!event.canceled)
        onPressMessage?.(context, currentMessage)
    },
  })

  // The message neither shrinks nor lifts: the menu opens where the finger is.
  const longPressGesture = useLongPressGesture({
    testID: 'message-long-press',
    minDuration: PRESS_HOLD_MS,
    cancelsTouchesInView: false,
    onBegin: () => {
      runOnJS(measureBubble)()
    },
    onActivate: event => {
      runOnJS(onLongPressStart)(event.absoluteX, event.absoluteY)
    },
  })

  const gesture = useExclusiveGestures(longPressGesture, tapGesture)

  // `rowSurface` spans the whole message row, so a long-press in the empty
  // space beside the bubble opens the picker too.
  const web = Platform.OS === 'web' && isContextMenuEnabled ? { onContextMenu: (event: { preventDefault: () => void, stopPropagation: () => void, nativeEvent: { pageX?: number, pageY?: number } }) => {
    event.preventDefault()
    event.stopPropagation()
    measureBubble()
    onLongPressStart(event.nativeEvent.pageX, event.nativeEvent.pageY)
  } } : {}
  const bubbleRow = (
    <View {...web} style={rowSurfaceStyle}>
      <View style={isLifted ? hiddenStyle : undefined}>
        <Animated.View style={wrapperStyleList} ref={bubbleContainerRef}>
          {children}
        </Animated.View>
      </View>
    </View>
  )

  if (Platform.OS === 'web' && isContextMenuEnabled)
    return (
      isGestureEnabled
        ? <WebContextMenuDetector gesture={gesture} measureBubble={measureBubble} onLongPressStart={onLongPressStart}>{bubbleRow}</WebContextMenuDetector>
        : <><WebContextMenuDetector gesture={gesture} measureBubble={measureBubble} onLongPressStart={onLongPressStart}><View style={StyleSheet.absoluteFill} /></WebContextMenuDetector>{bubbleRow}</>
    )

  if (isGestureEnabled)
    return (
      <GestureDetector gesture={gesture}>
        {bubbleRow}
      </GestureDetector>
    )

  // Gestures are off for this message, so the surface drops *behind*
  // the bubble: the bubble's own content (native video controls, a
  // map, a WebView) keeps every touch that lands on it, while the rest
  // of the row still opens the picker.
  return (
    <>
      <GestureDetector gesture={gesture}>
        <View style={StyleSheet.absoluteFill} />
      </GestureDetector>
      {bubbleRow}
    </>
  )
}

/** Mount the extra recognizer only for the opt-in web surface. */
function WebContextMenuDetector ({ gesture, measureBubble, onLongPressStart, children }: {
  gesture: ReturnType<typeof useExclusiveGestures>
  measureBubble: () => void
  onLongPressStart: (x?: number, y?: number) => void
  children: React.ReactElement
}) {
  const rightClickGesture = useTapGesture({
    enabled: true,
    mouseButton: MouseButton.RIGHT,
    runOnJS: true,
    onDeactivate: event => {
      if (!event.canceled) {
        measureBubble()
        onLongPressStart(event.absoluteX, event.absoluteY)
      }
    },
  })
  const combinedGesture = useExclusiveGestures(rightClickGesture, gesture)
  return <GestureDetector gesture={combinedGesture}>{children}</GestureDetector>
}
