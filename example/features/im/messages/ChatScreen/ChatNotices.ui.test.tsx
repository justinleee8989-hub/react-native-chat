import React from 'react'
import { StyleSheet } from 'react-native'
import { expect, it, jest } from '@jest/globals'
import { fireEvent, render } from '@testing-library/react-native'
import { productPalette } from '../../ui/tokens'
import { ChatNotices } from './ChatNotices'
import { MissingConversation } from './MissingConversation'

jest.mock('../../ui/preferences', () => ({ useLanguageChoice: () => 'zh', useProductLayout: () => ({ desktop: false }), useProductScheme: () => 'dark' }))
jest.mock('expo-router', () => ({ useRouter: () => ({ canGoBack: () => true, back: jest.fn(), replace: jest.fn() }) }))

const colorOf = (node: { props: { style?: unknown } }) => StyleSheet.flatten(node.props.style as never)?.color

it('says a chat\'s failures in the theme\'s red and its status in the secondary text, readable in dark mode', async () => {
  const retry = jest.fn()
  const view = await render(
    <ChatNotices accessError='会话权限暂未确认，请重试' onRetryAccess={retry} draftError={false} onRetryDraft={jest.fn()} locating />
  )
  expect(colorOf(view.getByRole('alert'))).toBe(productPalette.dark.danger)
  expect(colorOf(view.getByText('正在定位消息…'))).toBe(productPalette.dark.text2)
  expect(colorOf(view.getByText('重试同步会话权限'))).toBe(productPalette.dark.accent)
  await fireEvent.press(view.getByRole('button', { name: '重试同步会话权限' }))
  expect(retry).toHaveBeenCalledTimes(1)
})

it('gives a missing chat a themed way back and a readable hint', async () => {
  const view = await render(<MissingConversation />)
  expect(colorOf(view.getByText('返回会话列表'))).toBe(productPalette.dark.accent)
  expect(view.getByRole('button', { name: '返回会话列表' })).toBeTruthy()
  expect(colorOf(view.getByText(/正在同步会话/))).toBe(productPalette.dark.text2)
})
