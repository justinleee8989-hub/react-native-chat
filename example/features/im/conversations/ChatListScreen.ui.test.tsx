import React from 'react'
import { Pressable as MockPressable, Text as MockText, TextInput as MockTextInput, View as MockView } from 'react-native'
import { expect, it, jest } from '@jest/globals'
import { fireEvent, render } from '@testing-library/react-native'
import ChatListScreen from './ChatListScreen'

const mockPin = jest.fn<(...args: unknown[]) => Promise<void>>(async () => {})
const mockArchive = jest.fn<(...args: unknown[]) => Promise<void>>(async () => {})
const mockRemove = jest.fn<(...args: unknown[]) => Promise<void>>(async () => {})
const mockPush = jest.fn()
const mockHistory = jest.fn()
const mockConversations = [{ conversationID: 'one', conversationType: 1, showName: 'Alice', unreadCount: 0 }, { conversationID: 'two', conversationType: 1, showName: 'Bob', unreadCount: 0 }]
const mockReady = jest.fn()
let mockListProps: any
let mockBusy = false
let mockLoaded = true
let mockError = ''
jest.mock('../navigation/StartupReadiness', () => ({ useStartupReadiness: () => ({ markReady: mockReady }) }))
let mockStatus = '已连接'
jest.mock('../application/store', () => ({ prefetchConversationHistory: (id: string) => mockHistory(id), useOpenIM: () => ({ session: { userID: 'me', imToken: 'token' }, conversations: mockConversations, messages: { one: [{ clientMsgID: 'old', contentType: 101, textElem: { content: 'older unique text' } }] }, busy: mockBusy, conversationsLoaded: mockLoaded, error: mockError, status: mockStatus }), setPinned: (...args: unknown[]) => mockPin(...args as []), setArchived: (...args: unknown[]) => mockArchive(...args as []), removeConversations: (...args: unknown[]) => mockRemove(...args as []), setMuted: jest.fn(), refresh: jest.fn(), reportError: jest.fn() }))
jest.mock('expo-router', () => ({ usePathname: () => '/chats/one', useFocusEffect: () => {}, useRouter: () => ({ push: mockPush, prefetch: (href: string) => {
  const { notifyChatEntryReady } = require('../navigation/chat-entry'); notifyChatEntryReady('me:token', decodeURIComponent(href.split('/').at(-1) || ''))
} }) }))
jest.mock('../ui/preferences', () => ({ useProductScheme: () => 'light', useProductLayout: () => ({ desktop: false }) }))
jest.mock('../ui/theme', () => ({ useProductTheme: () => ({}) }))
jest.mock('../ui/ProductChatTheme', () => ({ useProductChatTheme: () => ({}) }))
jest.mock('../ui/ProductIcon', () => ({ ProductIcon: () => null }))
jest.mock('../calls/invitation', () => ({ parseCallInvitation: () => null }))
jest.mock('../ui/primitives', () => ({
  ProductHeader: ({ title, right }: { title: string, right: React.ReactNode }) => <MockView><MockText>{title}</MockText>{right}</MockView>,
  ProductSearch: (props: any) => <MockTextInput accessibilityLabel='搜索' {...props} />,
  ProductSheet: ({ children, items }: any) => <MockView>{children}{items?.map((item: any) => <MockPressable key={item.title} onPress={item.onPress}><MockText>{item.title}</MockText></MockPressable>)}</MockView>,
  ProductRow: ({ title, onPress }: { title: string, onPress: () => void }) => <MockPressable onPress={onPress}><MockText>{title}</MockText></MockPressable>,
}))
jest.mock('./ProductChatRow', () => ({ ProductChatRow: ({ chat, onPress, onMenu, onSwipe }: { chat: { title: string }, onPress: () => void, onMenu: () => void, onSwipe: () => void }) => <MockView><MockPressable onPress={onPress} onLongPress={onMenu}><MockText>{chat.title}</MockText></MockPressable><MockPressable onPress={onSwipe}><MockText>swipe {chat.title}</MockText></MockPressable></MockView> }))
jest.mock('@kesha-antonov/react-native-chat', () => ({ ChatList: (props: any) => {
  mockListProps = props
  const { chats, renderChat, onArchiveChats } = props
  return <MockView>{chats.map((chat: any) => <MockView key={chat.id}>{renderChat({ chat, onSwipe: () => onArchiveChats([chat], true) })}</MockView>)}</MockView>
} }))
jest.mock('../shared/shared', () => ({ Confirm: ({ onConfirm, onCancel }: { onConfirm: () => void, onCancel: () => void }) => <MockView><MockPressable onPress={onConfirm}><MockText>确认删除</MockText></MockPressable><MockPressable onPress={onCancel}><MockText>取消删除</MockText></MockPressable></MockView> }))

it('shows reconnecting status', async () => {
  mockStatus = '连接断开，正在重连'
  const view = await render(<ChatListScreen autoRefresh={false} />)
  try {
    expect(view.getByText('连接断开，正在重连')).toBeTruthy()
  } finally {
    mockStatus = '已连接'
  }
})
it('hides the connection status when connected', async () => {
  mockStatus = '已连接'
  const view = await render(<ChatListScreen autoRefresh={false} />)
  expect(view.queryByText('已连接')).toBeNull()
})

it('runs batch pin using real conversation IDs after menu selection', async () => {
  const view = await render(<ChatListScreen autoRefresh={false} />)
  await fireEvent(view.getByText('Alice'), 'longPress')
  await fireEvent.press(view.getByText('多选'))
  await fireEvent.press(view.getByText('Bob'))
  await fireEvent.press(view.getByText('置顶'))
  expect(mockPin).toHaveBeenCalledWith(['one', 'two'], true)
})
it('requires confirmation before removal and preserves SDK swipe action', async () => {
  const view = await render(<ChatListScreen autoRefresh={false} />)
  await fireEvent(view.getByText('Alice'), 'longPress')
  await fireEvent.press(view.getByText('删除会话'))
  expect(mockRemove).not.toHaveBeenCalled()
  await fireEvent.press(view.getByText('确认删除'))
  expect(mockRemove).toHaveBeenCalledWith(['one'])
  await fireEvent.press(view.getByText('swipe Bob'))
  expect(mockArchive).toHaveBeenCalledWith(['two'], true)
})
it('compose menu retains real secondary destinations', async () => {
  const view = await render(<ChatListScreen autoRefresh={false} />)
  await fireEvent.press(view.getByLabelText('新建'))
  await fireEvent.press(view.getByText('创建群聊'))
  expect(mockPush).toHaveBeenCalledWith('/chats/groups/create')
})

it('searches loaded older message text and excludes unmatched conversations', async () => {
  const view = await render(<ChatListScreen autoRefresh={false} />)
  await fireEvent.changeText(view.getByLabelText('搜索'), 'older unique')
  expect(view.getByText('Alice')).toBeTruthy()
  expect(view.queryByText('Bob')).toBeNull()
})


it('uses cached history without refreshing the store before navigation', async () => {
  const view = await render(<ChatListScreen autoRefresh={false} />)
  await fireEvent.press(view.getByText('Alice'))
  expect(mockHistory).not.toHaveBeenCalled()
  expect(mockPush).toHaveBeenCalledWith('/chats/one')
})

it('keeps background sync out of pull-to-refresh and reports only prepared content', async () => {
  mockBusy = true
  const saved = mockConversations.splice(0)
  mockLoaded = false
  try {
    const view = await render(<ChatListScreen autoRefresh={false} />)
    expect(mockListProps.listProps.refreshing).toBe(false)
    mockListProps.listProps.onContentSizeChange(390, 100)
    expect(mockReady).not.toHaveBeenCalled()
    mockLoaded = true
    await view.rerender(<ChatListScreen autoRefresh={false} />)
    mockListProps.listProps.onContentSizeChange(390, 100)
    expect(mockReady).toHaveBeenCalledWith({ userID: 'me', imToken: 'token' })
  } finally {
    mockConversations.push(...saved)
    mockLoaded = true
    mockBusy = false
  }
})
it('accepts laid-out cached rows before background synchronization finishes', async () => {
  mockBusy = true
  mockLoaded = false
  try {
    await render(<ChatListScreen autoRefresh={false} />)
    expect(mockListProps.isLoading).toBe(false)
    mockListProps.listProps.onContentSizeChange(390, 160)
    expect(mockReady).toHaveBeenCalled()
  } finally {
    mockBusy = false
    mockLoaded = true
  }
})
