import React from 'react'
import { expect, it, jest } from '@jest/globals'
import { render } from '@testing-library/react-native'
import { ProductBubble } from './ProductMessage'

jest.mock('../ui/primitives', () => ({ ProductAvatar: () => null }))
jest.mock('react-native-gesture-handler', () => {
  const React = require('react')
  const { View } = require('react-native')
  return {
    GestureHandlerRootView: ({ children }: { children: React.ReactNode }) => <View>{children}</View>,
    GestureDetector: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    MouseButton: { RIGHT: 2 },
    useExclusiveGestures: (...gestures: unknown[]) => gestures,
    useLongPressGesture: () => ({}),
    useTapGesture: () => ({}),
  }
})
jest.mock('../ui/ProductIcon', () => ({ ProductIcon: () => null }))
jest.mock('./ProductAudio', () => ({ ProductAudio: () => null }))
jest.mock('./ProductContextMenu', () => ({ ProductContextMenu: () => null }))
jest.mock('./ProductFile', () => ({ ProductFile: () => null }))
jest.mock('./ProductQuote', () => ({ ProductQuote: () => null }))

it('adds and clears product reactions across real Bubble rerenders', async () => {
  const currentMessage = {
    _id: 'reaction-target',
    text: '',
    createdAt: new Date(),
    user: { _id: 'self' },
    sent: true,
    reactions: [],
  }
  const props = {
    currentMessage,
    previousMessage: {},
    nextMessage: {},
    position: 'right',
    user: { _id: 'self' },
    // Disable the gesture picker so this regression isolates Bubble's custom
    // reaction renderer, which still runs in the default rendering path.
    reactions: { isEnabled: false, emojis: ['👍'], onReactionPress: jest.fn() },
  } as any
  const view = await render(<ProductBubble {...props} />)
  expect(view.queryByRole('button', { name: '👍 1' })).toBeNull()
  await view.rerender(<ProductBubble {...props} currentMessage={{ ...currentMessage, reactions: [{ emoji: '👍', userIds: ['self'] }] }} />)
  expect(view.getByRole('button', { name: '👍 1' })).toBeTruthy()
  await view.rerender(<ProductBubble {...props} currentMessage={{ ...currentMessage, reactions: [] }} />)
  expect(view.queryByRole('button', { name: '👍 1' })).toBeNull()
})
