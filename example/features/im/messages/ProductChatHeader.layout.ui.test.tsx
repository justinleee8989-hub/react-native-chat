import React from 'react'
import { StyleSheet } from 'react-native'
import { expect, it, jest } from '@jest/globals'
import { render } from '@testing-library/react-native'
import { ProductChatHeader } from './ProductChatHeader'

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), canGoBack: () => false }) }))
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }) }))
jest.mock('../navigation/DesktopNavigation', () => ({ useDesktopNavigation: () => null }))
jest.mock('../ui/preferences', () => ({ useLanguageChoice: () => 'auto', useProductLayout: () => ({ desktop: true }) }))
jest.mock('../ui/theme', () => ({ useProductTheme: () => ({ page: '#page', bg: '#surface', line: '#line', text: '#text', text3: '#muted', accent: '#accent' }) }))
jest.mock('../ui/primitives', () => {
  const Native = require('react-native')
  return { ProductAvatar: () => <Native.View testID='header-avatar' /> }
})
jest.mock('../ui/ProductPage', () => {
  const Native = require('react-native')
  return { ProductIconButton: ({ label }: { label: string }) => <Native.Pressable accessibilityRole='button' accessibilityLabel={label} /> }
})

it('uses the surface color and aligned desktop avatar/title in the chat header', async () => {
  const view = await render(<ProductChatHeader conversation={{ conversationID: 'group-1', groupID: 'group-1', showName: 'QA 群' } as any} typing='' onCall={jest.fn()} onMore={jest.fn()} />)
  const tree = view.toJSON() as any
  const background = StyleSheet.flatten(tree.props.style)
  const row = StyleSheet.flatten(tree.children[0].props.style)
  const informationButtons = view.getAllByRole('button', { name: '聊天信息' })

  expect(background.backgroundColor).toBe('#surface')
  expect(row.paddingLeft).toBe(16)
  expect(row.paddingRight).toBe(12)
  expect(informationButtons[0].props.style.marginLeft).toBe(4)
  expect(informationButtons[1].props.style.paddingLeft).toBe(8)
  expect(informationButtons[1].props.style.paddingRight).toBe(8)
})
