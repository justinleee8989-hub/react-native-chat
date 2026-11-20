import React from 'react'
import { Text } from 'react-native'
import { expect, it, jest } from '@jest/globals'
import { act, render } from '@testing-library/react-native'
import { useInFront } from './useInFront'

// The page's focus, as the navigator reports it: blur runs the effect's cleanup, focus runs it.
let mockBlur: (() => void) | void
let mockFocus: () => void = () => {}
jest.mock('expo-router', () => ({
  useFocusEffect: (effect: () => void | (() => void)) => {
    mockFocus = () => {
      mockBlur = effect()
    }
  },
}))

function Page () {
  return <Text>{useInFront() ? 'front' : 'covered'}</Text>
}

it('is in front until a page opens over it, and again once it comes back', async () => {
  const view = await render(<Page />)
  expect(view.getByText('front')).toBeTruthy()
  await act(() => mockFocus())
  expect(view.getByText('front')).toBeTruthy()

  await act(() => mockBlur?.())
  expect(view.getByText('covered')).toBeTruthy()

  await act(() => mockFocus())
  expect(view.getByText('front')).toBeTruthy()
})
