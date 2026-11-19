import React from 'react'
import { Platform, StyleSheet, Text } from 'react-native'
import { expect, it, jest } from '@jest/globals'
import { render } from '@testing-library/react-native'
import { productPalette as mockProductPalette } from '../ui/tokens'
import { ProductPickerModal } from './ProductPickerModal'
const mockKeyboard = jest.fn<(props: { enabled?: boolean, behavior?: string }) => void>()
let mockDesktop = false
jest.mock('react-native/Libraries/Components/Keyboard/KeyboardAvoidingView', () => {
  const React = require('react'), { View } = require('react-native')
  return { __esModule: true, default: (props: any) => {
    mockKeyboard(props); return React.createElement(View, {}, props.children)
  } }
})
jest.mock('../ui/preferences', () => ({ useLanguageChoice: () => 'auto', useProductLayout: () => ({ desktop: mockDesktop }), useProductScheme: () => 'light' }))
jest.mock('../ui/theme', () => ({ useProductTheme: () => mockProductPalette.light }))
jest.mock('../ui/ProductIcon', () => ({ ProductIcon: () => null }))
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }))
it.each(['ios', 'android', 'web'] as const)('uses padding avoidance only on iOS, retaining %s system geometry', async platform => {
  const original = Platform.OS
  Platform.OS = platform
  try {
    const view = await render(<ProductPickerModal title='发送位置' onClose={jest.fn()}><Text>位置表单</Text></ProductPickerModal>)
    expect(view.getByText('位置表单')).toBeTruthy()
    expect(mockKeyboard).toHaveBeenCalled()
    expect(mockKeyboard.mock.calls.at(-1)?.[0].enabled).toBe(platform === 'ios')
    expect(mockKeyboard.mock.calls.at(-1)?.[0].behavior).toBe(platform === 'ios' ? 'padding' : undefined)
  } finally {
    Platform.OS = original
  }
})

it('keeps the desktop picker frame gray with rounded corners', async () => {
  mockDesktop = true
  try {
    const view = await render(<ProductPickerModal title='选择名片' onClose={jest.fn()}><Text>好友 Alice</Text></ProductPickerModal>)
    let frame = view.getByText('好友 Alice').parent
    while (frame && !StyleSheet.flatten(frame.props.style)?.borderBottomLeftRadius)
      frame = frame.parent
    expect(frame).toBeTruthy()
    expect(StyleSheet.flatten(frame!.props.style)).toMatchObject({
      backgroundColor: mockProductPalette.light.bg,
      borderTopLeftRadius: 18,
      borderTopRightRadius: 18,
      borderBottomLeftRadius: 18,
      borderBottomRightRadius: 18,
    })
  } finally {
    mockDesktop = false
  }
})

it('keeps phone picker pages rounded at the top edge', async () => {
  mockDesktop = false
  const view = await render(<ProductPickerModal title='选择名片' onClose={jest.fn()}><Text>好友 Bob</Text></ProductPickerModal>)
  let frame = view.getByText('好友 Bob').parent
  while (frame && StyleSheet.flatten(frame.props.style)?.backgroundColor !== mockProductPalette.light.bg)
    frame = frame.parent
  expect(StyleSheet.flatten(frame?.props.style)).toMatchObject({ borderTopLeftRadius: 20, borderTopRightRadius: 20 })
})
