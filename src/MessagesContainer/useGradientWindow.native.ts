import { useCallback, useLayoutEffect } from 'react'
import { useWindowDimensions, View } from 'react-native'
import { useKeyboardHandler } from 'react-native-keyboard-controller'
import { measure, useAnimatedRef, useFrameCallback, useSharedValue } from 'react-native-reanimated'

/** Follow native keyboard transforms on the UI thread; idle scrolling needs no measurements. */
export function useGradientWindow (enabled: boolean) {
  const ref = useAnimatedRef<View>()
  const { width, height } = useWindowDimensions()
  const frame = useSharedValue({ top: 0, height: 0 })
  const moving = useSharedValue(false)
  const pendingFrames = useSharedValue(0)
  const onLayout = useCallback(() => {
    if (enabled)
      pendingFrames.set(2)
  }, [enabled, pendingFrames])

  useLayoutEffect(() => {
    onLayout()
  }, [onLayout, width, height])

  useKeyboardHandler({
    onStart: () => {
      'worklet'
      moving.set(enabled)
    },
    onEnd: () => {
      'worklet'
      moving.set(false)
      // Include the final native layout commit, which can follow the keyboard end event.
      pendingFrames.set(enabled ? 2 : 0)
    },
  }, [enabled])

  useFrameCallback(() => {
    if (!enabled || (!moving.value && pendingFrames.value === 0))
      return
    if (pendingFrames.value > 0)
      pendingFrames.set(pendingFrames.value - 1)
    const measured = measure(ref)
    if (measured && Number.isFinite(measured.pageY) &&
      (frame.value.top !== measured.pageY || frame.value.height !== height))
      frame.set({ top: measured.pageY, height })
  })

  return { ref, onLayout, frame }
}
