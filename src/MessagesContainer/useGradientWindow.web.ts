import { useCallback, useEffect, useLayoutEffect, useRef, type ComponentRef, type RefObject } from 'react'
import { useWindowDimensions, View } from 'react-native'
import { KeyboardEvents } from 'react-native-keyboard-controller'
import { useSharedValue, type SharedValue } from 'react-native-reanimated'

/** Measures on layout/window changes and settled keyboard transitions; scrolling stays in shared values. */
export function useGradientWindow (enabled: boolean): {
  ref: RefObject<ComponentRef<typeof View> | null>
  onLayout: () => void
  frame: SharedValue<{ top: number, height: number }>
} {
  const ref = useRef<ComponentRef<typeof View>>(null)
  const generation = useRef(0)
  const { width, height } = useWindowDimensions()
  const frame = useSharedValue({ top: 0, height: 0 })
  const onLayout = useCallback(() => {
    if (!enabled)
      return
    const current = ++generation.current
    ref.current?.measureInWindow((_x, top) => {
      if (generation.current === current && Number.isFinite(top))
        frame.set({ top, height })
    })
  }, [enabled, frame, height])

  const invalidate = useCallback(() => {
    generation.current++
  }, [])

  useLayoutEffect(() => {
    onLayout()
    return invalidate
  }, [onLayout, width, invalidate])

  useEffect(() => {
    if (!enabled)
      return
    // KeyboardAvoidingView also translates its children. Layout can measure an intermediate
    // transform; its final position does not emit another layout event after the keyboard settles.
    const shown = KeyboardEvents.addListener?.('keyboardDidShow', onLayout)
    const hidden = KeyboardEvents.addListener?.('keyboardDidHide', onLayout)
    return () => {
      shown?.remove()
      hidden?.remove()
      invalidate()
    }
  }, [enabled, onLayout, invalidate])

  return { ref, onLayout, frame }
}
