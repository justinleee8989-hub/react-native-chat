import { expect, it, jest } from '@jest/globals'
import { act, renderHook, waitFor } from '@testing-library/react-native'
import { useConversationAccess } from './useConversationAccess'
const mockGroup = jest.fn<(...args: unknown[]) => Promise<unknown>>()
const mockMember = jest.fn<(...args: unknown[]) => Promise<unknown>>()
const mockBlacklist = jest.fn<() => Promise<unknown[]>>()
jest.mock('../application/directory', () => ({ groupDirectoryEvents: [], subscribeDirectory: () => () => {}, directory: { group: (...args: unknown[]) => mockGroup(...args), member: (...args: unknown[]) => mockMember(...args) } }))
jest.mock('../application/profile', () => ({ profile: { blacklist: () => mockBlacklist() } }))
const conversation = { conversationID: 'g', groupID: 'g', conversationType: 3, showName: 'Group', unreadCount: 0 }
it('uses real group mute permissions and accepts expired millisecond timestamps', async () => {
  mockGroup.mockResolvedValue({ status: 3, memberCount: 19 })
  mockMember.mockResolvedValue({ roleLevel: 20 })
  const view = await renderHook(() => useConversationAccess(conversation, 'self'))
  await waitFor(() => expect(view.result.current.notice).toBe('全员禁言中'))
  expect(view.result.current.count).toBe(19)
  mockMember.mockResolvedValue({ roleLevel: 60, muteEndTime: Date.now() - 10000 })
  await act(async () => view.result.current.refresh())
  expect(view.result.current.notice).toBe('')
})
it('does not let a superseded blacklist request overwrite current permissions', async () => {
  let first!: (value: unknown[]) => void
  mockBlacklist.mockImplementationOnce(() => new Promise(resolve => {
    first = resolve
  })).mockResolvedValueOnce([])
  const view = await renderHook(() => useConversationAccess({ ...conversation, groupID: undefined, userID: 'peer' }, 'self'))
  await act(async () => view.result.current.refresh())
  await act(async () => first([{ userID: 'peer' }]))
  expect(view.result.current.notice).toBe('')
})
it('shows only the current accounts own blacklist and exposes retryable failures', async () => {
  mockBlacklist.mockResolvedValueOnce([{ userID: 'peer' }]).mockRejectedValueOnce(new Error('权限同步失败'))
  const view = await renderHook(() => useConversationAccess({ ...conversation, groupID: undefined, userID: 'peer' }, 'self'))
  await waitFor(() => expect(view.result.current.notice).toBe('已加入黑名单，无法发送消息'))
  await act(async () => view.result.current.refresh())
  expect(view.result.current.error).toBe('权限同步失败')
  expect(view.result.current.notice).toBe('已加入黑名单，无法发送消息')
})

it('blocks sending when the group has been dissolved even if self membership remains', async () => {
  mockGroup.mockResolvedValue({ status: 2, memberCount: 0 })
  mockMember.mockResolvedValue({ roleLevel: 60 })
  const view = await renderHook(() => useConversationAccess(conversation, 'self'))
  await waitFor(() => expect(view.result.current.notice).toBe('群聊已解散，无法发送消息'))
})
it('blocks sending when the current user is no longer a group member', async () => {
  mockGroup.mockResolvedValue({ status: 0, memberCount: 5 })
  mockMember.mockResolvedValue(undefined)
  const view = await renderHook(() => useConversationAccess(conversation, 'self'))
  await waitFor(() => expect(view.result.current.notice).toBe('你已不在群聊中，无法发送消息'))
})
it('keeps sending blocked while permissions are still synchronizing', async () => {
  mockGroup.mockImplementation(() => new Promise(() => {}))
  mockMember.mockImplementation(() => new Promise(() => {}))
  const view = await renderHook(() => useConversationAccess(conversation, 'self'))
  expect(view.result.current.notice).toBe('正在同步会话权限…')
})
it('hides SDK diagnostics and keeps sending blocked after a permission failure until retry succeeds', async () => {
  mockGroup.mockRejectedValueOnce(new Error('rpc error: code = Internal desc = /workspace/private.go:20'))
    .mockResolvedValueOnce({ status: 0, memberCount: 5 })
  mockMember.mockResolvedValue({ roleLevel: 60 })
  const view = await renderHook(() => useConversationAccess(conversation, 'self'))
  await waitFor(() => expect(view.result.current.error).toBe('操作失败，请稍后重试'))
  expect(view.result.current.notice).not.toBe('')
  await act(async () => view.result.current.refresh())
  expect(view.result.current.notice).toBe('')
  expect(view.result.current.error).toBe('')
})

it('blocks sending when a previously successful permission refresh later fails', async () => {
  mockGroup.mockResolvedValueOnce({ status: 0, memberCount: 5 })
    .mockRejectedValueOnce(new Error('rpc error: code = Internal desc = /workspace/private.go:20'))
  mockMember.mockResolvedValue({ roleLevel: 60 })
  const view = await renderHook(() => useConversationAccess(conversation, 'self'))
  await waitFor(() => expect(view.result.current.notice).toBe(''))
  await act(async () => view.result.current.refresh())
  expect(view.result.current.error).toBe('操作失败，请稍后重试')
  expect(view.result.current.notice).not.toBe('')
})

it('blocks sending for a group unavailable state', async () => {
  mockGroup.mockResolvedValue({ status: 1, memberCount: 5 })
  mockMember.mockResolvedValue({ roleLevel: 60 })
  const view = await renderHook(() => useConversationAccess(conversation, 'self'))
  await waitFor(() => expect(view.result.current.notice).toBe('群聊当前不可用，无法发送消息'))
})
