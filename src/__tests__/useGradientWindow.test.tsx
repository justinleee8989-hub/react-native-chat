import React from 'react'
import { View } from 'react-native'
import { act, render } from '@testing-library/react-native'

import { useGradientWindow } from '../MessagesContainer/useGradientWindow.web'

const mockKeyboardListeners = new Map<string, Set<() => void>>()
jest.mock('react-native-keyboard-controller', () => ({
  ...jest.requireActual('react-native-keyboard-controller/jest'),
  KeyboardEvents: {
    addListener: (event: string, listener: () => void) => {
      const listeners = mockKeyboardListeners.get(event) ?? new Set()
      listeners.add(listener)
      mockKeyboardListeners.set(event, listeners)
      return { remove: () => listeners.delete(listener) }
    },
  },
}))

it('remeasures after keyboard transforms settle without requiring another layout event', async () => {
  let measuredTop = 96
  let current: ReturnType<typeof useGradientWindow> | undefined
  const measure = jest.spyOn(View.prototype as unknown as { measureInWindow: unknown }, 'measureInWindow' as never)
    .mockImplementation(((callback: (x: number, y: number) => void) => callback(0, measuredTop)) as never)
  function Probe () {
    const gradient = useGradientWindow(true)
    React.useLayoutEffect(() => {
      current = gradient
    }, [gradient])
    return <View ref={gradient.ref} onLayout={gradient.onLayout} testID='gradient' />
  }
  const view = await render(<Probe />)
  try {
    for (const event of ['keyboardDidShow', 'keyboardDidHide']) {
      measuredTop = -280
      await act(() => view.getByTestId('gradient').props.onLayout())
      expect(current?.frame.get().top).toBe(-280)
      measuredTop = 96
      await act(() => mockKeyboardListeners.get(event)?.forEach(listener => listener()))
      expect(current?.frame.get().top).toBe(96)
    }
    await view.unmount()
    expect([...mockKeyboardListeners.values()].every(listeners => listeners.size === 0)).toBe(true)
  } finally {
    measure.mockRestore()
  }
})
