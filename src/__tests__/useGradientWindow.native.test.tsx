import React from 'react'
import { View } from 'react-native'
import { act, render } from '@testing-library/react-native'
import { useKeyboardHandler } from 'react-native-keyboard-controller'
import * as Reanimated from 'react-native-reanimated'

import { useGradientWindow } from '../MessagesContainer/useGradientWindow.native'

it('tracks each native keyboard animation frame without waiting for a JS completion event', async () => {
  let current: ReturnType<typeof useGradientWindow> | undefined
  let tick: (() => void) | undefined
  let keyboard: { onStart?: () => void, onEnd?: () => void } | undefined
  let top = 96
  const measure = jest.spyOn(Reanimated, 'measure').mockImplementation(() => ({ x: 0, y: 0, width: 390, height: 600, pageX: 0, pageY: top }))
  const frames = jest.spyOn(Reanimated, 'useFrameCallback').mockImplementation(callback => {
    tick = () => callback({ timestamp: 0, timeSincePreviousFrame: 16, timeSinceFirstFrame: 0 })
    return { setActive: () => {}, isActive: true, callbackId: 1 }
  })
  jest.mocked(useKeyboardHandler).mockImplementation(handlers => {
    keyboard = handlers as typeof keyboard
  })
  function Probe () {
    const gradient = useGradientWindow(true)
    React.useLayoutEffect(() => {
      current = gradient
    }, [gradient])
    return <View ref={gradient.ref} onLayout={gradient.onLayout} />
  }
  const view = await render(<Probe />)
  try {
    await act(() => keyboard?.onStart?.())
    for (const next of [-280, -160, -40, 96]) {
      top = next
      await act(() => tick?.())
      expect(current?.frame.get().top).toBe(next)
    }
    await act(() => keyboard?.onEnd?.())
    await act(() => {
      tick?.()
      tick?.()
      tick?.()
    })
    measure.mockClear()
    await act(() => tick?.())
    expect(measure).not.toHaveBeenCalled()
  } finally {
    await view.unmount()
    measure.mockRestore()
    frames.mockRestore()
  }
})

it('keeps the frame callback off while nothing moves, so an open chat lets the display idle', async () => {
  const states: boolean[] = []
  let autostart: boolean | undefined
  let tick: (() => void) | undefined
  let keyboard: { onStart?: () => void, onEnd?: () => void } | undefined
  const measure = jest.spyOn(Reanimated, 'measure').mockImplementation(() => ({ x: 0, y: 0, width: 390, height: 600, pageX: 0, pageY: 96 }))
  const frames = jest.spyOn(Reanimated, 'useFrameCallback').mockImplementation((callback, start) => {
    autostart = start
    tick = () => callback({ timestamp: 0, timeSincePreviousFrame: 16, timeSinceFirstFrame: 0 })
    return { setActive: (active: boolean) => states.push(active), isActive: false, callbackId: 1 }
  })
  jest.mocked(useKeyboardHandler).mockImplementation(handlers => {
    keyboard = handlers as typeof keyboard
  })
  function Probe ({ enabled }: { enabled: boolean }) {
    const gradient = useGradientWindow(enabled)
    return <View ref={gradient.ref} onLayout={gradient.onLayout} />
  }
  const view = await render(<Probe enabled />)
  try {
    expect(autostart).toBe(false)
    // The first layout queues two measurements, then the callback switches itself off.
    expect(states.at(-1)).toBe(true)
    await act(() => {
      tick?.()
      tick?.()
    })
    expect(states.at(-1)).toBe(true)
    await act(() => tick?.())
    expect(states.at(-1)).toBe(false)

    await act(() => keyboard?.onStart?.())
    expect(states.at(-1)).toBe(true)
    await act(() => tick?.())
    expect(states.at(-1)).toBe(true)
    await act(() => keyboard?.onEnd?.())
    await act(() => {
      tick?.()
      tick?.()
      tick?.()
    })
    expect(states.at(-1)).toBe(false)

    states.length = 0
    await view.rerender(<Probe enabled={false} />)
    await act(() => keyboard?.onStart?.())
    expect(states.every(active => !active)).toBe(true)
  } finally {
    await view.unmount()
    measure.mockRestore()
    frames.mockRestore()
  }
})
