import React from 'react'
import { Platform, StyleSheet } from 'react-native'
import { expect, it, jest } from '@jest/globals'
import { act, fireEvent, render, waitFor } from '@testing-library/react-native'
import ForwardPicker from './ForwardPicker'
const mockOuterModal = jest.fn<(props: { onRequestClose: () => void }) => void>()
jest.mock('react-native/Libraries/Modal/Modal', () => {
  const React = require('react'), { View } = require('react-native')
  return { __esModule: true, default: (props: any) => {
    if (!props.testID)
      mockOuterModal(props); return React.createElement(View, {}, props.children)
  } }
})
const mockForward = jest.fn<(...args: unknown[]) => Promise<void>>()
let mockDesktop = false
jest.mock('../application/store', () => ({ useOpenIM: () => ({ session: { userID: 'self', imToken: 'token' }, conversations: [{ conversationID: 'c1', showName: '小林' }, { conversationID: 'c2', showName: '小周' }] }), forwardMessage: (...args: unknown[]) => mockForward(...args) }))
jest.mock('../auth/LoginScreen', () => () => null)
jest.mock('expo-router', () => ({ useRouter: () => ({}) }))
jest.mock('../ui/preferences', () => ({ useLanguageChoice: () => 'auto', useProductLayout: () => ({ desktop: mockDesktop }), useProductScheme: () => 'light' }))
jest.mock('../ui/ProductIcon', () => ({ ProductIcon: () => null }))
it('confirms the selected recipient and blocks dismissal and duplicate sends while pending', async () => {
  let finish!: () => void
  mockForward.mockImplementation(() => new Promise(resolve => {
    finish = resolve
  }))
  const close = jest.fn()
  const message = { clientMsgID: 'm1', contentType: 101, sendTime: 1000, status: 2 }
  const view = await render(<ForwardPicker message={message} onClose={close} />)
  await fireEvent.press(view.getByText('小林'))
  expect(mockForward).not.toHaveBeenCalled()
  await fireEvent.press(view.getByText('转发'))
  await fireEvent.press(view.getByText('转发'))
  await act(async () => {
    mockOuterModal.mock.calls.at(-1)?.[0].onRequestClose()
  })
  expect(close).not.toHaveBeenCalled()
  expect(mockForward).toHaveBeenCalledTimes(1)
  expect(mockForward).toHaveBeenCalledWith('c1', message)
  await act(async () => finish())
  await waitFor(() => expect(close).toHaveBeenCalledTimes(1))
})

it('uses the transparent desktop picker surface, rounded corners, and visible inset row separators', async () => {
  const original = Platform.OS
  const previous = mockDesktop
  Platform.OS = 'web'
  mockDesktop = true
  try {
    const message = { clientMsgID: 'm2', contentType: 101, sendTime: 1000, status: 2 }
    const view = await render(<ForwardPicker message={message} onClose={jest.fn()} />)
    let node: ReturnType<typeof view.getByText> | null = view.getByText('小林')
    let row: ReturnType<typeof view.getByText> | undefined
    while (node) {
      if (node.props.accessibilityRole === 'button') {
        row = node
        break
      }
      node = node.parent
    }
    expect(StyleSheet.flatten(row?.props.style)?.backgroundColor).toBe('transparent')
    let separator = view.getByText('小林').parent
    while (separator && !String(StyleSheet.flatten(separator.props.style)?.boxShadow || '').includes('inset 0 -0.5px 0'))
      separator = separator.parent
    expect(StyleSheet.flatten(separator?.props.style)?.boxShadow).toContain('inset 0 -0.5px 0')
    let frame = view.getByText('小林').parent
    while (frame && StyleSheet.flatten(frame.props.style)?.borderBottomLeftRadius !== 18)
      frame = frame.parent
    expect(StyleSheet.flatten(frame?.props.style)).toMatchObject({
      borderTopLeftRadius: 18,
      borderTopRightRadius: 18,
      borderBottomLeftRadius: 18,
      borderBottomRightRadius: 18,
    })
  } finally {
    Platform.OS = original
    mockDesktop = previous
  }
})

jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }))
