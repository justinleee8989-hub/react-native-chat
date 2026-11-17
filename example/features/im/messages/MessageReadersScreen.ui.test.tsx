import React from 'react'
import { expect, it, jest } from '@jest/globals'
import { render } from '@testing-library/react-native'
import MessageReadersScreen from './MessageReadersScreen'

const mockFetchReaders = jest.fn<(session: unknown, base: string, id: string, messageID: string, seq: number) => Promise<{ members: [], readCount: number, unreadCount: number, excludedJoinedLater: number }>>()
const mockSyncMessageReaders = jest.fn()
const mockMembers = jest.fn(async () => [])
const mockRun = jest.fn((work: (current: () => boolean) => Promise<void>) => {
  void work
  return Promise.resolve()
})
jest.mock('../application/store', () => ({ useOpenIM: () => ({
  session: { userID: 'me', imToken: 'im', chatToken: 'chat' },
  config: { chat: 'http://local' },
  conversations: [],
}), syncMessageReaders: (...args: unknown[]) => mockSyncMessageReaders(...args) }))
jest.mock('../application/directory', () => ({ directory: { members: () => mockMembers() } }))
jest.mock('../messages/readers', () => ({ fetchMessageReaders: (...args: Parameters<typeof mockFetchReaders>) => mockFetchReaders(...args) }))
jest.mock('../shared/useTask', () => ({ useTask: () => ({ busy: false, error: '', run: mockRun }) }))
jest.mock('../auth/LoginScreen', () => () => null)
jest.mock('../groups/group-ui', () => ({ HeaderAction: () => null, ProductHint: () => null }))
jest.mock('../ui/primitives', () => ({ ProductSegment: () => null, ProductAvatar: () => null, ProductListRow: () => null }))
jest.mock('../ui/ProductPage', () => ({ ProductEmpty: () => null, ProductPage: ({ children }: React.PropsWithChildren) => <>{children}</> }))
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }))

it('does not synchronize an old reader response after refreshing the same message at a newer sequence', async () => {
  let resolveOld!: (value: { members: [], readCount: number, unreadCount: number, excludedJoinedLater: number }) => void
  mockFetchReaders.mockImplementationOnce(() => new Promise(resolve => {
    resolveOld = resolve
  }))
  mockFetchReaders.mockResolvedValueOnce({ members: [], readCount: 0, unreadCount: 0, excludedJoinedLater: 0 })
  const view = await render(<MessageReadersScreen id='group-a' messageID='message-a' seq={1} />)
  expect(mockRun).toHaveBeenCalled()
  let oldCurrent = true
  const oldTask = mockRun.mock.calls[0][0](() => oldCurrent)

  await view.rerender(<MessageReadersScreen id='group-a' messageID='message-a' seq={2} />)
  oldCurrent = false
  await mockRun.mock.calls[1][0](() => true)
  resolveOld({ members: [], readCount: 1, unreadCount: 0, excludedJoinedLater: 0 })
  await oldTask

  expect(mockSyncMessageReaders).toHaveBeenCalledTimes(1)
  expect(mockSyncMessageReaders).toHaveBeenCalledWith('group-a', 'message-a', 0, 0)
})
