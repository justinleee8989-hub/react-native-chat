import { useCallback, useLayoutEffect, useRef } from 'react'
import { useWindowDimensions, View } from 'react-native'
import { useKeyboardHandler } from 'react-native-keyboard-controller'
import { measure, runOnJS, useAnimatedRef, useFrameCallback, useSharedValue } from 'react-native-reanimated'

/**
 * Follow native keyboard transforms on the UI thread; idle scrolling needs no measurements.
 *
 * The frame callback runs only while there is something to measure: an always-on callback keeps
 * the display link ticking at the screen's full rate for as long as a chat is open, so the app
 * never goes idle and the screen cannot drop its refresh rate.
 */
export function useGradientWindow (enabled: boolean) {
  const ref = useAnimatedRef<View>()
  const { width, height } = useWindowDimensions()
  const frame = useSharedValue({ top: 0, height: 0 })
  const moving = useSharedValue(false)
  const pendingFrames = useSharedValue(0)
  const control = useRef<(active: boolean) => void>(() => {})
  const setRunning = useCallback((active: boolean) => {
    // A stop asked for by an idle frame can arrive after new work was queued from JS.
    if (!active && (moving.get() || pendingFrames.get() > 0))
      return
    control.current(active)
  }, [moving, pendingFrames])
  const onLayout = useCallback(() => {
    if (!enabled)
      return
    pendingFrames.set(2)
    setRunning(true)
  }, [enabled, pendingFrames, setRunning])

  useKeyboardHandler({
    onStart: () => {
      'worklet'
      moving.set(enabled)
      if (enabled)
        runOnJS(setRunning)(true)
    },
    onEnd: () => {
      'worklet'
      moving.set(false)
      // Include the final native layout commit, which can follow the keyboard end event.
      pendingFrames.set(enabled ? 2 : 0)
      if (enabled)
        runOnJS(setRunning)(true)
    },
  }, [enabled])

  const callback = useFrameCallback(() => {
    if (!enabled || (!moving.value && pendingFrames.value === 0)) {
      runOnJS(setRunning)(false)
      return
    }
    if (pendingFrames.value > 0)
      pendingFrames.set(pendingFrames.value - 1)
    const measured = measure(ref)
    if (measured && Number.isFinite(measured.pageY) &&
      (frame.value.top !== measured.pageY || frame.value.height !== height))
      frame.set({ top: measured.pageY, height })
  }, false)

  useLayoutEffect(() => {
    control.current = active => callback.setActive(active && enabled)
    if (!enabled)
      callback.setActive(false)
  }, [callback, enabled])

  useLayoutEffect(() => {
    onLayout()
  }, [onLayout, width, height])

  return { ref, onLayout, frame }
}
