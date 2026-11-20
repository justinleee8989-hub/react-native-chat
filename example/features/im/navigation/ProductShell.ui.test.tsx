import React, { useState } from 'react'
import { TextInput } from 'react-native'
import { expect, it, jest } from '@jest/globals'
import { act, fireEvent, render } from '@testing-library/react-native'
import { showProductToast } from '../shared/ProductToast'
import ProductShell from './ProductShell'
let mockDesktop = false
let mockPath = '/chats/id'
jest.mock('./useRailNavigation', () => ({ useRailNavigation: () => () => {} }))
jest.mock('./usePendingRequests', () => ({ usePendingRequests: () => 0 }))
jest.mock('../ui/preferences', () => ({ useLanguageChoice: () => 'auto', useProductLayout: () => ({ desktop: mockDesktop }), useProductScheme: () => 'light' }))
jest.mock('../ui/theme', () => ({ useProductTheme: () => ({}) }))
jest.mock('../application/profile', () => ({ profile: { self: jest.fn() } }))
jest.mock('../application/store', () => ({ useOpenIM: () => ({ conversations: [] }) }))
jest.mock('expo-router', () => ({ usePathname: () => mockPath, useRouter: () => ({}) }))
jest.mock('../contacts/ContactsScreen', () => () => null)
jest.mock('../conversations/ChatListScreen', () => () => null)
jest.mock('./MyScreen', () => () => null)
jest.mock('../calls/CallHistoryScreen', () => () => null)
jest.mock('../ui/primitives', () => ({ ProductAvatar: () => null }))
jest.mock('../ui/ProductIcon', () => ({ ProductIcon: () => null }))
function Draft () {
  const [value, setValue] = useState('')
  return <TextInput accessibilityLabel='draft' value={value} onChangeText={setValue} />
}
it.each([false, true])('preserves draft across layout changes (master=%s)', async master => {
  mockDesktop = false
  const view = await render(<ProductShell master={master}><Draft /></ProductShell>)
  await fireEvent.changeText(view.getByLabelText('draft'), 'unsent')
  mockDesktop = true
  await view.rerender(<ProductShell master={master}><Draft /></ProductShell>)
  expect(view.getByLabelText('draft').props.value).toBe('unsent')
  mockDesktop = false
  await view.rerender(<ProductShell master={master}><Draft /></ProductShell>)
  expect(view.getByLabelText('draft').props.value).toBe('unsent')
})
it.each([
  [true, '/chats', true],
  [true, '/contacts', false], // The contacts page beside it shows its own
  [true, '/calls', false], // The calls page beside it shows its own
  [false, '/chats', false], // The chat list shows it on a phone
])('desktop=%s %s: the empty pane shows toasts: %s', async (desktop, path, shown) => {
  jest.useFakeTimers()
  mockDesktop = desktop
  mockPath = path
  const view = await render(<ProductShell master><Draft /></ProductShell>)
  await act(async () => showProductToast('call ended'))
  expect(!!view.queryByText('call ended')).toBe(shown)
  await act(async () => jest.runAllTimers())
  jest.useRealTimers()
  mockPath = '/chats/id'
})
