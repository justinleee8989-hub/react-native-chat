import React from 'react'
import { beforeEach, expect, it, jest } from '@jest/globals'
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { directory } from '../application/directory'
import { checkGroupManagement, groupManagement } from '../application/group-management'
import { openConversation, refresh } from '../application/store'
import { ProductError } from '../shared/product-error'
import CreateGroupScreen from './CreateGroupScreen'
import GroupManagementScreen from './GroupManagementScreen'
import GroupsScreen from './GroupsScreen'
import InviteGroupScreen from './InviteGroupScreen'
import JoinGroupScreen from './JoinGroupScreen'
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: require('react-native').View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }))
const mockPush = jest.fn()
const mockReplace = jest.fn()
const mockBack = jest.fn()
let mockCanGoBack = false
let mockManage = ''
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, canGoBack: () => mockCanGoBack, replace: mockReplace, back: mockBack }), useLocalSearchParams: () => ({ id: 'g1', manage: mockManage }) }))
jest.mock('../application/store', () => ({ openConversation: jest.fn(), refresh: jest.fn(), useOpenIM: () => ({ session: { userID: 'self', imToken: 'token' } }) }))
jest.mock('../application/directory', () => ({ directory: { groups: jest.fn(), member: jest.fn(), friends: jest.fn(), create: jest.fn(), members: jest.fn(), group: jest.fn(), update: jest.fn(), dismiss: jest.fn(), leave: jest.fn(), invite: jest.fn() }, groupDirectoryEvents: [], subscribeDirectory: () => () => {} }))
jest.mock('../application/group-management', () => ({ checkGroupManagement: jest.fn(), groupApplicationEvents: [], groupManagement: { requests: jest.fn(async () => []), muteGroup: jest.fn(), role: jest.fn(), muteMember: jest.fn(), join: jest.fn() } }))
jest.mock('../auth/LoginScreen', () => () => null)
beforeEach(() => {
  jest.clearAllMocks(); mockCanGoBack = false; mockManage = ''; jest.mocked(directory.friends).mockResolvedValue([{ userID: 'friend', nickname: '好友' }]); jest.mocked(directory.create).mockResolvedValue({ groupID: 'new', groupName: '新群' }); jest.mocked(openConversation).mockResolvedValue('real-conversation'); jest.mocked(refresh).mockResolvedValue(undefined); jest.mocked(directory.member).mockResolvedValue({ userID: 'self', roleLevel: 100 }); jest.mocked(directory.members).mockResolvedValue([{ userID: 'friend', nickname: '好友', roleLevel: 20 }]); jest.mocked(directory.group).mockResolvedValue({ groupID: 'g1', groupName: '测试群', memberCount: 2 }); jest.mocked(directory.update).mockResolvedValue(undefined); jest.mocked(checkGroupManagement).mockResolvedValue(undefined); jest.mocked(groupManagement.requests).mockResolvedValue([]); jest.mocked(directory.groups).mockResolvedValue([{ groupID: 'g1', groupName: '测试群', memberCount: 3 }])
})
it('keeps the group list page shape while groups load: only the group rows are placeholders', async () => {
  jest.mocked(directory.groups).mockReturnValue(new Promise(() => {}))
  await render(<GroupsScreen />)
  expect(screen.getByText('入群申请')).toBeTruthy()
  expect(screen.getByText('我加入的群聊')).toBeTruthy()
  expect(screen.getByLabelText('正在加载内容')).toBeTruthy()
  expect(screen.queryByText('还没有加入群聊')).toBeNull()
  expect(screen.queryByLabelText('正在处理')).toBeNull()
})
it('opens creation and join on separate pages from the new menu', async () => {
  await render(<GroupsScreen />)
  await waitFor(() => expect(screen.getByText('测试群')).toBeTruthy())
  expect(screen.queryByLabelText('群名称')).toBeNull()
  await fireEvent.press(screen.getByLabelText('新建'))
  await fireEvent.press(screen.getByText('创建群聊'))
  expect(mockPush).toHaveBeenCalledWith('/chats/groups/create')
  await fireEvent.press(screen.getByLabelText('新建'))
  await fireEvent.press(screen.getByText('通过群 ID 加群'))
  expect(mockPush).toHaveBeenCalledWith('/chats/groups/join')
  await fireEvent.press(screen.getByText('测试群'))
  expect(mockPush).toHaveBeenCalledWith('/chats/groups/g1')
})

it('creates a real group and opens its conversation instead of its profile', async () => {
  await render(<CreateGroupScreen />)
  await waitFor(() => expect(screen.getByRole('checkbox', { name: '好友' })).toBeTruthy())
  await fireEvent.changeText(screen.getByLabelText('给群聊起个名字'), '新群')
  await fireEvent.press(screen.getByRole('checkbox', { name: '好友' }))
  await fireEvent.press(screen.getByRole('button', { name: '创建' }))
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/chats/real-conversation'))
  expect(directory.create).toHaveBeenCalledWith('新群', ['friend'])
  expect(openConversation).toHaveBeenCalledWith('new', 3)
})
it('shows a validation error when confirming a cleared group name', async () => {
  await render(<GroupManagementScreen />)
  await waitFor(() => expect(screen.getByText('群聊名称')).toBeTruthy())
  await fireEvent.press(screen.getByText('群聊名称'))
  await fireEvent.changeText(screen.getByLabelText('群名称'), '   ')
  await fireEvent.press(screen.getByRole('button', { name: '确定' }))
  await waitFor(() => expect(screen.getAllByText('请输入群名称').length).toBeGreaterThan(0))
  expect(directory.update).not.toHaveBeenCalled()
})
it('joins only after confirmation and replaces to groups when there is no history', async () => {
  await render(<JoinGroupScreen />)
  await fireEvent.changeText(screen.getByLabelText('群 ID'), 'g2')
  await fireEvent.press(screen.getByRole('button', { name: '申请加群' }))
  expect(groupManagement.join).not.toHaveBeenCalled()
  await fireEvent.press(screen.getByRole('button', { name: '申请' }))
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/chats/groups'))
  expect(mockBack).not.toHaveBeenCalled()
  expect(groupManagement.join).toHaveBeenCalledWith('g2', '')
})
it('returns with back navigation after joining when history exists', async () => {
  mockCanGoBack = true
  await render(<JoinGroupScreen />)
  await fireEvent.changeText(screen.getByLabelText('群 ID'), 'g2')
  await fireEvent.press(screen.getByRole('button', { name: '申请加群' }))
  await fireEvent.press(screen.getByRole('button', { name: '申请' }))
  await waitFor(() => expect(mockBack).toHaveBeenCalledTimes(1))
  expect(mockReplace).not.toHaveBeenCalled()
  expect(groupManagement.join).toHaveBeenCalledWith('g2', '')
})
it('replaces to the group invite page when inviting without history', async () => {
  jest.mocked(directory.members).mockResolvedValue([])
  jest.mocked(directory.invite).mockResolvedValue(undefined)
  await render(<InviteGroupScreen />)
  await waitFor(() => expect(screen.getByRole('checkbox', { name: '好友' })).toBeTruthy())
  await fireEvent.press(screen.getByRole('checkbox', { name: '好友' }))
  await fireEvent.press(screen.getByRole('button', { name: '邀请(1)' }))
  await waitFor(() => expect(directory.invite).toHaveBeenCalledWith('g1', ['friend']))
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/chats/groups/g1'))
  expect(mockBack).not.toHaveBeenCalled()
})
it('uses back navigation after inviting when history exists', async () => {
  mockCanGoBack = true
  jest.mocked(directory.members).mockResolvedValue([])
  jest.mocked(directory.invite).mockResolvedValue(undefined)
  await render(<InviteGroupScreen />)
  await waitFor(() => expect(screen.getByRole('checkbox', { name: '好友' })).toBeTruthy())
  await fireEvent.press(screen.getByRole('checkbox', { name: '好友' }))
  await fireEvent.press(screen.getByRole('button', { name: '邀请(1)' }))
  await waitFor(() => expect(mockBack).toHaveBeenCalledTimes(1))
  expect(mockReplace).not.toHaveBeenCalled()
  expect(directory.invite).toHaveBeenCalledWith('g1', ['friend'])
})
it('revalidates permission before direct full mute and blocks stale permissions', async () => {
  jest.mocked(checkGroupManagement).mockRejectedValueOnce(new ProductError('group.permissionChanged'))
  await render(<GroupManagementScreen />)
  await waitFor(() => expect(screen.getByRole('switch', { name: '全员禁言' })).toBeTruthy())
  await fireEvent.press(screen.getByRole('switch', { name: '全员禁言' }))
  await waitFor(() => expect(screen.getByText('群成员或权限已变化，请刷新后重试')).toBeTruthy())
  expect(groupManagement.muteGroup).not.toHaveBeenCalled()
  expect(screen.queryByRole('button', { name: '确认' })).toBeNull()
  await fireEvent.press(screen.getByRole('switch', { name: '全员禁言' }))
  await waitFor(() => expect(groupManagement.muteGroup).toHaveBeenCalledWith('g1', true))
})
it('hides management mode when the current member no longer has management permission', async () => {
  mockManage = '1'
  jest.mocked(directory.member).mockResolvedValue({ userID: 'self', roleLevel: 20 })
  await render(<GroupManagementScreen membersPage />)
  await waitFor(() => expect(screen.getByText('好友')).toBeTruthy())
  expect(screen.getByText('群成员')).toBeTruthy()
  expect(screen.queryByText('成员管理')).toBeNull()
  expect(screen.queryByText('点成员可设置管理员、禁言或移出群组。')).toBeNull()
})

it('member menu offers only the applicable mute operation and updates roles directly', async () => {
  mockManage = '1'
  await render(<GroupManagementScreen membersPage />)
  await waitFor(() => expect(screen.getByText('好友')).toBeTruthy())
  await fireEvent.press(screen.getByText('好友'))
  expect(screen.getByRole('button', { name: '禁言 1 小时' })).toBeTruthy()
  expect(screen.queryByRole('button', { name: '解除禁言' })).toBeNull()
  await fireEvent.press(screen.getByRole('button', { name: '设为管理员' }))
  await waitFor(() => expect(groupManagement.role).toHaveBeenCalledWith('g1', 'friend', true))
  expect(checkGroupManagement).toHaveBeenCalledWith('g1', 'self', expect.any(Function), 'role', 'friend')
})

it('explains when a dissolved group cannot be accessed by the current user', async () => {
  jest.mocked(directory.member).mockResolvedValueOnce(undefined as never)
  jest.mocked(directory.group).mockResolvedValueOnce({ groupID: 'g1', groupName: '测试群', memberCount: 2, status: 2 })
  await render(<GroupManagementScreen />)
  await waitFor(() => expect(screen.getByText('群聊已解散')).toBeTruthy())
  expect(screen.getByText('无法继续管理此群聊，请返回会话列表。')).toBeTruthy()
  expect(screen.queryByText('成员')).toBeNull()
})

it.each([
  ['群主', 100, ['群聊名称', '群公告', '邀请好友入群', '成员管理', '全员禁言', '解散群组'], []],
  ['管理员', 60, ['群聊名称', '群公告', '邀请好友入群', '成员管理', '全员禁言', '退出群组'], ['解散群组']],
  ['普通成员', 20, ['邀请好友入群', '退出群组'], ['群聊名称', '群公告', '成员管理', '全员禁言', '解散群组']],
  ['非成员', 0, [], ['邀请好友入群', '退出群组', '群聊名称', '群公告', '成员管理', '全员禁言', '解散群组']],
])('shows only the group management actions allowed for %s', async (_role, roleLevel, visible, hidden) => {
  jest.mocked(directory.member).mockResolvedValue({ userID: 'self', roleLevel })
  await render(<GroupManagementScreen />)
  await waitFor(() => expect(screen.getByText('成员')).toBeTruthy())
  for (const title of visible)
    expect(screen.getByText(title)).toBeTruthy()
  for (const title of hidden)
    expect(screen.queryByText(title)).toBeNull()
})
