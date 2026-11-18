import React from 'react'
import { StyleSheet } from 'react-native'
import { expect, it, jest } from '@jest/globals'
import { fireEvent, render, screen } from '@testing-library/react-native'
import { productPalette as mockProductPalette } from '../ui/tokens'
import NewMessageScreen from './NewMessageScreen'

const mockReplace = jest.fn()
const mockBack = jest.fn()
let mockRouterCanGoBack = false
let mockDesktop = false
let mockCanGoBackInSection = true
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace, back: mockBack, canGoBack: () => mockRouterCanGoBack }) }))
jest.mock('../application/store', () => ({ openConversation: jest.fn(), useOpenIM: () => ({ session: { userID: 'self', imToken: 'token' } }) }))
jest.mock('../auth/LoginScreen', () => () => null)
jest.mock('../ui/preferences', () => ({ useProductLayout: () => ({ desktop: mockDesktop }), useProductScheme: () => 'light' }))
jest.mock('../ui/theme', () => ({ useProductTheme: () => mockProductPalette.light }))
jest.mock('../ui/ProductIcon', () => ({ ProductIcon: () => null }))
jest.mock('../shared/ProductToast', () => ({ ProductToast: () => null }))
jest.mock('../navigation/DesktopNavigation', () => ({ useDesktopNavigation: () => ({ canGoBackInSection: mockCanGoBackInSection }) }))
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }) }))

it('keeps the registered-user instruction between the ID field and the open action', async () => {
  await render(<NewMessageScreen />)
  const instruction = screen.getByText('请输入对方的完整用户 ID。')
  const action = screen.getByRole('button', { name: '打开会话' })
  expect(instruction.props.style).toMatchObject({ paddingHorizontal: 32, paddingTop: 8 })
  let node = instruction.parent
  while (node) {
    expect(StyleSheet.flatten(node.props.style)?.marginHorizontal).not.toBe(16)
    node = node.parent
  }
  let buttonContainer = action.parent
  let hasButtonInset = false
  while (buttonContainer) {
    if (StyleSheet.flatten(buttonContainer.props.style)?.marginHorizontal === 16)
      hasButtonInset = true
    buttonContainer = buttonContainer.parent
  }
  expect(hasButtonInset).toBe(true)
  let actionSpacing
  node = action.parent
  while (node) {
    const style = StyleSheet.flatten(node.props.style)
    if (style?.marginTop === 24)
      actionSpacing = style
    node = node.parent
  }
  expect(actionSpacing).toMatchObject({ marginHorizontal: 16, marginTop: 24 })
})

it('shows a desktop back button on the new chat root and falls back to chats for a deep link', async () => {
  mockDesktop = true
  mockCanGoBackInSection = false
  mockRouterCanGoBack = false
  const view = await render(<NewMessageScreen />)
  await fireEvent.press(view.getByLabelText('返回'))
  expect(mockReplace).toHaveBeenCalledWith('/(tabs)/chats')
  expect(mockBack).not.toHaveBeenCalled()
})
