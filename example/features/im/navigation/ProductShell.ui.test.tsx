import React, { useState } from 'react'
import { TextInput } from 'react-native'
import { expect, it, jest } from '@jest/globals'
import { fireEvent, render } from '@testing-library/react-native'
import ProductShell from './ProductShell'
let mockDesktop = false
jest.mock('./useRailNavigation', () => ({ useRailNavigation: () => () => {} }))
jest.mock('./usePendingRequests', () => ({ usePendingRequests: () => 0 }))
jest.mock('../ui/preferences', () => ({ useProductLayout: () => ({ desktop: mockDesktop }), useProductScheme: () => 'light' }))
jest.mock('../ui/theme', () => ({ useProductTheme: () => ({}) }))
jest.mock('../application/profile', () => ({ profile: { self: jest.fn() } }))
jest.mock('../application/store', () => ({ useOpenIM: () => ({ conversations: [] }) }))
jest.mock('expo-router', () => ({ usePathname: () => '/chats/id', useRouter: () => ({}) }))
jest.mock('../contacts/ContactsScreen', () => () => null)
jest.mock('../conversations/ChatListScreen', () => () => null)
jest.mock('./MyScreen', () => () => null)
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
