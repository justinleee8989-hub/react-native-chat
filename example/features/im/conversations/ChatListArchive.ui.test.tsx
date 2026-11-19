import React from 'react'
import { StyleSheet } from 'react-native'
import { expect, it, jest } from '@jest/globals'
import { render } from '@testing-library/react-native'
import ChatListScreen from './ChatListScreen'

const archivedEx = JSON.stringify({
  $reactNativeChatArchive: { version: 1, archivedByUser: { me: true } },
})
const mockConversations = [
  { conversationID: 'active', conversationType: 1, userID: 'active-user', showName: 'Active Eva', unreadCount: 0 },
  { conversationID: 'archived-alex', conversationType: 1, userID: 'archived-alex', showName: 'Archived Alex', unreadCount: 0, ex: archivedEx },
  { conversationID: 'archived-bea', conversationType: 1, userID: 'archived-bea', showName: 'Archived Bea', unreadCount: 0, ex: archivedEx },
]
const mockRenderedChatIDs: string[] = []
const mockPalette = { page: '#F8F9FC', bg: '#FFFFFF', surface: '#FFFFFF', surface2: '#EEF1F6', text: '#162033', text2: '#586174', text3: '#788194', accent: '#2864D7', accentWeak: '#E7EEFF', onAccent: '#FFFFFF', line: '#DDE2EA', danger: '#D33B49', scrim: '#00000066' }
const mockRouter = { push: jest.fn(), replace: jest.fn() }

jest.mock('../application/store', () => ({
  useOpenIM: () => ({ session: { userID: 'me', imToken: 'token' }, conversations: mockConversations, messages: {}, busy: false, status: '已连接' }),
  refresh: jest.fn(), reportError: jest.fn(), setPinned: jest.fn(), setMuted: jest.fn(), removeConversations: jest.fn(), setArchived: jest.fn(),
}))
jest.mock('expo-router', () => ({ usePathname: () => '/chats', useFocusEffect: () => {}, useRouter: () => mockRouter }))
jest.mock('../navigation/DesktopNavigation', () => ({ useDesktopNavigation: () => ({ canGoBackInSection: true }), useMasterNavigation: () => jest.fn() }))
jest.mock('../ui/preferences', () => ({ useLanguageChoice: () => 'auto', useProductScheme: () => 'light', useProductLayout: () => ({ desktop: true }) }))
jest.mock('../ui/theme', () => ({ useProductTheme: () => mockPalette }))
jest.mock('../ui/ProductChatTheme', () => ({ useProductChatTheme: () => ({}) }))
jest.mock('../shared/ConnectionStatus', () => ({ ConnectionStatus: () => null }))
jest.mock('../shared/shared', () => ({ Confirm: () => null }))
jest.mock('../shared/useTask', () => ({ useTask: () => ({ run: jest.fn(), busy: false, error: undefined }) }))
jest.mock('../calls/invitation', () => ({ parseCallInvitation: () => null }))
jest.mock('../ui/ProductIcon', () => {
  const React = jest.requireActual<typeof import('react')>('react')
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native')
  return {
    ProductIcon: ({ name, color, size = 22 }: { name: string, color: string, size?: number }) => React.createElement(Text, {
      testID: `product-icon-${name}`,
      accessibilityLabel: `${name}|${color}|${size}`,
    }, name),
  }
})
jest.mock('../ui/ProductPage', () => {
  const React = jest.requireActual<typeof import('react')>('react')
  const { Pressable, Text } = jest.requireActual<typeof import('react-native')>('react-native')
  return {
    ProductEmpty: ({ title }: { title: string }) => React.createElement(Text, null, title),
    ProductIconButton: ({ label, onPress }: { label: string, onPress: () => void }) => React.createElement(Pressable, { accessibilityRole: 'button', accessibilityLabel: label, onPress }),
  }
})
jest.mock('./ProductChatRow', () => {
  const React = jest.requireActual<typeof import('react')>('react')
  const { Pressable, Text } = jest.requireActual<typeof import('react-native')>('react-native')
  return {
    ProductChatRow: ({ chat, onPress }: { chat: { title: string }, onPress: () => void }) => React.createElement(Pressable, { accessibilityRole: 'button', accessibilityLabel: chat.title, onPress }, React.createElement(Text, null, chat.title)),
  }
})
jest.mock('@kesha-antonov/react-native-chat', () => {
  const React = jest.requireActual<typeof import('react')>('react')
  const { View } = jest.requireActual<typeof import('react-native')>('react-native')
  return {
    ChatList: ({ chats, renderChat, isArchiveOpen }: { chats: { id: string }[], renderChat: (props: { chat: unknown }) => React.ReactNode, isArchiveOpen: boolean }) => {
      mockRenderedChatIDs.splice(0, mockRenderedChatIDs.length, ...chats.map(chat => String(chat.id)))
      return React.createElement(View, { testID: isArchiveOpen ? 'archived-chat-list' : 'main-chat-list' }, chats.map(chat => React.createElement(View, { key: String(chat.id) }, renderChat({ chat }))))
    },
  }
})

function ancestorWithStyle (instance: any, matches: (style: any) => boolean) {
  let current = instance.parent
  while (current) {
    const style = StyleSheet.flatten(current.props.style)
    if (style && matches(style))
      return current
    current = current.parent
  }
  return undefined
}

it('renders an archive summary with the product icon and keeps archived rows out of the main SDK list', async () => {
  mockRenderedChatIDs.length = 0
  const view = await render(<ChatListScreen autoRefresh={false} />)

  expect(view.getByText('已归档会话')).toBeTruthy()
  expect(view.getByText('2', { exact: true })).toBeTruthy()
  expect(view.getByText(/Archived Alex.*Archived Bea/)).toBeTruthy()
  expect(mockRenderedChatIDs).toEqual(['active'])

  const archiveIcon = view.getByTestId('product-icon-archive')
  expect(archiveIcon.props.accessibilityLabel).toBe(`archive|${mockPalette.text}|22`)
  const avatar = ancestorWithStyle(archiveIcon, style => style.width === 52 && style.height === 52)
  expect(avatar).toBeTruthy()
  expect(StyleSheet.flatten(avatar!.props.style)).toEqual(expect.objectContaining({ width: 52, height: 52, backgroundColor: mockPalette.surface2 }))
})

it('constrains desktop archive details to 680px and renders the 60px detail header', async () => {
  const view = await render(<ChatListScreen archived autoRefresh={false} />)
  const title = view.getByRole('header', { name: '已归档会话' })

  expect(ancestorWithStyle(title, style => style.maxWidth === 680)).toBeTruthy()
  expect(ancestorWithStyle(title, style => style.minHeight === 60)).toBeTruthy()
  expect(view.getByText('Archived Alex')).toBeTruthy()
  expect(view.getByText('Archived Bea')).toBeTruthy()
  expect(view.queryByText('Active Eva')).toBeNull()
})
