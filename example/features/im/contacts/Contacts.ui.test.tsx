import React from 'react'
import { beforeEach, expect, it, jest } from '@jest/globals'
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { directory, findUserIDByContact } from '../application/directory'
import { groupManagement } from '../application/group-management'
import { profile } from '../application/profile'
import AddFriendScreen from './AddFriendScreen'
import ContactsScreen from './ContactsScreen'
import FriendRequestsScreen from './FriendRequestsScreen'

const SEARCH = '用户 ID、邮箱或手机号'

const mockPush = jest.fn()
let mockInitialID = ''
jest.mock('react-native-safe-area-context', () => ({ ...jest.requireActual<object>('react-native-safe-area-context'), useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }) }))
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, canGoBack: () => false, replace: jest.fn() }), useLocalSearchParams: () => ({ id: mockInitialID }) }))
jest.mock('../application/store', () => ({ useOpenIM: () => ({ session: { userID: 'self', imToken: 'token', chatToken: 'chat' }, config: { chat: 'https://chat.example.test' } }) }))
jest.mock('../application/directory', () => ({ directory: { friends: jest.fn(), groups: jest.fn(), requests: jest.fn(), respond: jest.fn(), users: jest.fn(), add: jest.fn() }, contactDirectoryEvents: [], groupDirectoryEvents: [], subscribeDirectory: () => () => {}, findUserIDByContact: jest.fn() }))
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
  jest.mocked(directory.respond).mockRejectedValue(new Error('network request failed'))
  await render(<FriendRequestsScreen />)
  await waitFor(() => expect(screen.getByText('接受')).toBeTruthy())
  await fireEvent.press(screen.getByText('接受'))
  await waitFor(() => expect(screen.getByText('连接暂时失败，请检查网络后重试')).toBeTruthy())
  expect(screen.getByText('接受')).toBeTruthy()
  expect(screen.queryByText('已接受好友申请')).toBeNull()
})

it('checks all outgoing request pages and says a pending application on the row, with no button', async () => {
  jest.mocked(directory.requests).mockImplementation(async (_received, offset) => offset ? [{ fromUserID: 'self', toUserID: 'alice', handleResult: 0 }] : Array.from({ length: 30 }, (_, i) => ({ fromUserID: 'self', toUserID: `other-${i}`, handleResult: 1 })))
  await render(<AddFriendScreen />)
  await waitFor(() => expect(directory.requests).toHaveBeenCalledWith(false, 30))
  await fireEvent.changeText(screen.getByLabelText(SEARCH), 'alice')
  await fireEvent(screen.getByLabelText(SEARCH), 'submitEditing')
  await waitFor(() => expect(screen.getByText('已发送申请')).toBeTruthy())
  expect(screen.queryByRole('button', { name: '发送好友申请' })).toBeNull()
  expect(directory.add).not.toHaveBeenCalled()
})

it('opens a Latin keyboard for the ID, email or phone number, so no pinyin IME gets in the way', async () => {
  await render(<AddFriendScreen />)
  const field = screen.getByLabelText(SEARCH)
  expect(field.props.keyboardType).toBe('email-address')
  expect(field.props.autoCapitalize).toBe('none')
  expect(field.props.autoCorrect).toBe(false)
})

it('says a friend is already one on the row, with no note or button', async () => {
  jest.mocked(profile.person).mockResolvedValue({ userID: 'alice', nickname: 'Alice', isFriend: true })
  await render(<AddFriendScreen />)
  await fireEvent.changeText(screen.getByLabelText(SEARCH), 'alice')
  await fireEvent(screen.getByLabelText(SEARCH), 'submitEditing')
  await waitFor(() => expect(screen.getByText('已是好友')).toBeTruthy())
  expect(screen.queryByLabelText('好友申请说明')).toBeNull()
  expect(screen.queryByRole('button', { name: '发送好友申请' })).toBeNull()
})

it('searches on submit, not when empty, and sends an application', async () => {
  await render(<AddFriendScreen />)
  // An empty search does nothing.
  await fireEvent(screen.getByLabelText(SEARCH), 'submitEditing')
  expect(directory.users).not.toHaveBeenCalled()
  await fireEvent.changeText(screen.getByLabelText(SEARCH), 'alice')
  await fireEvent(screen.getByLabelText(SEARCH), 'submitEditing')
  await waitFor(() => expect(screen.getByRole('button', { name: '发送好友申请' })).toBeTruthy())
  await fireEvent.press(screen.getByRole('button', { name: '发送好友申请' }))
  await waitFor(() => expect(directory.add).toHaveBeenCalledWith('alice', '你好，希望添加你为好友'))
  await waitFor(() => expect(screen.getByText('已发送申请')).toBeTruthy())
})

it('looks up an email or phone number on the chat server, then shows that user', async () => {
  jest.mocked(findUserIDByContact).mockResolvedValue('alice')
  await render(<AddFriendScreen />)
  await fireEvent.changeText(screen.getByLabelText(SEARCH), 'alice@example.com')
  await fireEvent(screen.getByLabelText(SEARCH), 'submitEditing')
  await waitFor(() => expect(screen.getByText('Alice')).toBeTruthy())
  expect(findUserIDByContact).toHaveBeenCalledWith(expect.objectContaining({ chatToken: 'chat' }), 'https://chat.example.test', { email: 'alice@example.com' })
  expect(directory.users).toHaveBeenCalledWith('alice')
  await fireEvent.changeText(screen.getByLabelText(SEARCH), '+86 138 0013 8000')
  await fireEvent(screen.getByLabelText(SEARCH), 'submitEditing')
  await waitFor(() => expect(findUserIDByContact).toHaveBeenLastCalledWith(expect.anything(), 'https://chat.example.test', { areaCode: '+86', phoneNumber: '13800138000' }))
})

it('tries a number nobody has as their phone as a user ID, then says nobody has it', async () => {
  jest.mocked(findUserIDByContact).mockResolvedValue(undefined)
  jest.mocked(directory.users).mockResolvedValue([])
  await render(<AddFriendScreen />)
  await fireEvent.changeText(screen.getByLabelText(SEARCH), '13800138000')
  await fireEvent(screen.getByLabelText(SEARCH), 'submitEditing')
  await waitFor(() => expect(screen.getByText('请检查手机号是否完整')).toBeTruthy())
  expect(directory.users).toHaveBeenCalledWith('13800138000')
})

it('does not try an email nobody has as a user ID', async () => {
  jest.mocked(findUserIDByContact).mockResolvedValue(undefined)
  await render(<AddFriendScreen />)
  await fireEvent.changeText(screen.getByLabelText(SEARCH), 'nobody@example.com')
  await fireEvent(screen.getByLabelText(SEARCH), 'submitEditing')
  await waitFor(() => expect(screen.getByText('请检查邮箱是否完整')).toBeTruthy())
  expect(directory.users).not.toHaveBeenCalled()
})

it('loads a supplied person ID without an extra search tap', async () => {
  mockInitialID = 'alice'
  await render(<AddFriendScreen />)
  await waitFor(() => expect(screen.getByText('Alice')).toBeTruthy())
  expect(profile.person).toHaveBeenCalledWith('alice')
  expect(screen.getByRole('button', { name: '发送好友申请' })).toBeTruthy()
})

const manyFriends = ['张三', '李四', '王五', 'alice', 'Bob', '陈晨', '赵六', '孙七', '周八', '吴九'].map(name => ({ userID: name, nickname: name }))

it('groups 10 or more friends under letter headings with an index, flat while searching', async () => {
  jest.mocked(directory.friends).mockResolvedValue(manyFriends)
  await render(<ContactsScreen root />)
  await waitFor(() => expect(screen.getByLabelText('按字母定位')).toBeTruthy())
  // Headings for the letters present, in A–Z order.
  for (const letter of ['A', 'B', 'C', 'L', 'S', 'W', 'Z'])
    expect(screen.getAllByText(letter).length).toBeGreaterThan(0)
  await fireEvent.changeText(screen.getByLabelText('搜索好友'), '张')
  expect(screen.queryByLabelText('按字母定位')).toBeNull()
  expect(screen.getByText('张三')).toBeTruthy()
})

it('keeps a short friend list flat and without an index', async () => {
  await render(<ContactsScreen root />)
  await waitFor(() => expect(screen.getByText('同事')).toBeTruthy())
  expect(screen.queryByLabelText('按字母定位')).toBeNull()
})
