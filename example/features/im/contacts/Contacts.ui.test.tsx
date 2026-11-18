import React from 'react'
import { beforeEach, expect, it, jest } from '@jest/globals'
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { directory } from '../application/directory'
import { groupManagement } from '../application/group-management'
import { profile } from '../application/profile'
import AddFriendScreen from './AddFriendScreen'
import ContactsScreen from './ContactsScreen'
import FriendRequestsScreen from './FriendRequestsScreen'

const mockPush = jest.fn()
let mockInitialID = ''
jest.mock('react-native-safe-area-context', () => ({ ...jest.requireActual<object>('react-native-safe-area-context'), useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }) }))
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, canGoBack: () => false, replace: jest.fn() }), useLocalSearchParams: () => ({ id: mockInitialID }) }))
jest.mock('../application/store', () => ({ useOpenIM: () => ({ session: { userID: 'self', imToken: 'token' } }) }))
jest.mock('../application/directory', () => ({ directory: { friends: jest.fn(), groups: jest.fn(), requests: jest.fn(), respond: jest.fn(), users: jest.fn(), add: jest.fn() }, contactDirectoryEvents: [], groupDirectoryEvents: [], subscribeDirectory: () => () => {} }))
jest.mock('../application/group-management', () => ({ groupApplicationEvents: [], groupManagement: { requests: jest.fn() } }))
jest.mock('./ContactActions', () => ({ ContactActions: () => null }))
jest.mock('../application/profile', () => ({ profile: { person: jest.fn() } }))
jest.mock('../auth/LoginScreen', () => () => null)
jest.mock('@kesha-antonov/react-native-chat', () => ({ ...jest.requireActual<object>('@kesha-antonov/react-native-chat'), ChatListAvatar: () => null }))

beforeEach(() => {
  jest.clearAllMocks()
  mockInitialID = ''
  jest.mocked(directory.groups).mockResolvedValue([])
  jest.mocked(groupManagement.requests).mockResolvedValue([])
  jest.mocked(directory.friends).mockResolvedValue([{ userID: 'alice', nickname: 'Alice', remark: '同事' }, { userID: 'bob', nickname: 'Bob' }])
  jest.mocked(directory.requests).mockResolvedValue([{ fromUserID: 'alice', toUserID: 'self', fromNickname: 'Alice', reqMsg: '你好', handleResult: 0 }])
  jest.mocked(directory.respond).mockResolvedValue(undefined)
  jest.mocked(directory.users).mockResolvedValue([{ userID: 'alice', nickname: 'Alice' }])
  jest.mocked(profile.person).mockResolvedValue({ userID: 'alice', nickname: 'Alice', isFriend: false })
  jest.mocked(directory.add).mockResolvedValue(undefined)
})

it('keeps the page shape while friends load: only the friend rows are placeholders', async () => {
  jest.mocked(directory.friends).mockReturnValue(new Promise(() => {}))
  await render(<ContactsScreen root />)
  expect(screen.getByLabelText('搜索好友')).toBeTruthy()
  expect(screen.getByText('新的朋友')).toBeTruthy()
  expect(screen.getByText('群聊')).toBeTruthy()
  expect(screen.getByLabelText('正在加载内容')).toBeTruthy()
  expect(screen.queryByText('还没有好友')).toBeNull()
})

it('filters loaded friends by nickname and keeps actions on separate routes', async () => {
  await render(<ContactsScreen root />)
  await waitFor(() => expect(screen.getByText('同事')).toBeTruthy())
  expect(screen.queryByText('删除好友')).toBeNull()
  await fireEvent.press(screen.getByText('新的朋友'))
  expect(mockPush).toHaveBeenCalledWith('/chats/friend-requests')
  await fireEvent.press(screen.getByLabelText('添加好友'))
  expect(mockPush).toHaveBeenCalledWith('/chats/add-friend')
  await fireEvent.changeText(screen.getByLabelText('搜索好友'), 'alice')
  expect(screen.getByText('同事')).toBeTruthy()
  expect(screen.queryByText('Bob')).toBeNull()
  await fireEvent.press(screen.getByText('同事'))
  expect(mockPush).toHaveBeenCalledWith('/chats/people/alice')
})

it('does not empty requests when tapping the selected segment and routes outgoing requests correctly', async () => {
  await render(<FriendRequestsScreen />)
  await waitFor(() => expect(screen.getByText('Alice')).toBeTruthy())
  await fireEvent.press(screen.getByRole('tab', { name: '收到的申请' }))
  expect(screen.getByText('Alice')).toBeTruthy()
  await fireEvent.press(screen.getByRole('tab', { name: '发出的申请' }))
  await waitFor(() => expect(directory.requests).toHaveBeenCalledWith(false))
})

it('keeps accept and reject buttons outside the profile navigation button', async () => {
  await render(<FriendRequestsScreen />)
  await waitFor(() => expect(screen.getByRole('button', { name: '接受' })).toBeTruthy())
  for (const title of ['接受', '拒绝']) {
    let ancestor = screen.getByRole('button', { name: title }).parent
    while (ancestor) {
      expect(ancestor.props.accessibilityRole).not.toBe('button')
      ancestor = ancestor.parent
    }
  }
  jest.mocked(directory.respond).mockRejectedValueOnce(new Error('验证按钮隔离'))
  await fireEvent.press(screen.getByRole('button', { name: '接受' }))
  await waitFor(() => expect(directory.respond).toHaveBeenCalledWith('alice', true))
  expect(mockPush).not.toHaveBeenCalled()
})

it('keeps request actions available after a real service error', async () => {
  jest.mocked(directory.respond).mockRejectedValue(new Error('网络连接失败'))
  await render(<FriendRequestsScreen />)
  await waitFor(() => expect(screen.getByText('接受')).toBeTruthy())
  await fireEvent.press(screen.getByText('接受'))
  await waitFor(() => expect(screen.getByText('网络连接失败')).toBeTruthy())
  expect(screen.getByText('接受')).toBeTruthy()
  expect(screen.queryByText('已接受好友申请')).toBeNull()
})

it('checks all outgoing request pages and disables duplicate pending applications', async () => {
  jest.mocked(directory.requests).mockImplementation(async (_received, offset) => offset ? [{ fromUserID: 'self', toUserID: 'alice', handleResult: 0 }] : Array.from({ length: 30 }, (_, i) => ({ fromUserID: 'self', toUserID: `other-${i}`, handleResult: 1 })))
  await render(<AddFriendScreen />)
  await waitFor(() => expect(directory.requests).toHaveBeenCalledWith(false, 30))
  await fireEvent.changeText(screen.getByLabelText('完整用户 ID'), 'alice')
  await fireEvent.press(screen.getByText('查找'))
  await waitFor(() => expect(screen.getByText('已发送申请，等待对方处理')).toBeTruthy())
  await fireEvent.press(screen.getByText('已发送申请，等待对方处理'))
  expect(directory.add).not.toHaveBeenCalled()
})

it('shows a real-ID instruction while the add-friend form is empty', async () => {
  await render(<AddFriendScreen />)
  const hint = screen.getByText('输入完整用户 ID，查找后发送好友申请。')
  expect(hint.props.style).toMatchObject({ paddingHorizontal: 32, paddingTop: 8 })
  let node = hint.parent
  while (node) {
    expect(node.props.style?.marginHorizontal).not.toBe(16)
    node = node.parent
  }
})

it('loads a supplied person ID without an extra search tap', async () => {
  mockInitialID = 'alice'
  await render(<AddFriendScreen />)
  await waitFor(() => expect(screen.getByText('Alice')).toBeTruthy())
  expect(profile.person).toHaveBeenCalledWith('alice')
  expect(screen.getByRole('button', { name: '发送好友申请' })).toBeTruthy()
})
