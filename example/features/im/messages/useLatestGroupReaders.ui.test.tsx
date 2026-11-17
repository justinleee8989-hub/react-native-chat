import React from 'react'
import { beforeEach, expect, it, jest } from '@jest/globals'
import { act, render } from '@testing-library/react-native'
import type { GroupMessageReadInfo, Session } from '../domain/types'
import { useLatestGroupReaders } from './useLatestGroupReaders'

type ReaderResult = { members: [], readCount: number, unreadCount: number, excludedJoinedLater: number }
const mockFetchReaders = jest.fn<(session: Session, base: string, id: string, messageID: string, seq: number) => Promise<ReaderResult>>()
const session: Session = { userID: 'me', imToken: 'im', chatToken: 'chat' }
const sync = jest.fn()
jest.mock('./readers', () => ({ fetchMessageReaders: (...args: Parameters<typeof mockFetchReaders>) => mockFetchReaders(...args) }))
beforeEach(() => {
  mockFetchReaders.mockReset()
  sync.mockReset()
})

function Probe ({ id, message, enabled = true, readInfo, refreshToken = 0 }: { id: string, message?: { clientMsgID: string, seq?: number }, enabled?: boolean, readInfo?: GroupMessageReadInfo, refreshToken?: number }) {
  useLatestGroupReaders({ session, chatURL: 'http://chat', conversationID: id, message, readInfo, enabled, refreshToken, sync })
  return null
}

it('fetches only the current message once and ignores a stale response for its previous sequence', async () => {
  let resolveOld!: (result: ReaderResult) => void
  mockFetchReaders.mockImplementationOnce(() => new Promise(resolve => {
    resolveOld = resolve
  }))
  mockFetchReaders.mockResolvedValueOnce({ members: [], readCount: 2, unreadCount: 0, excludedJoinedLater: 1 })
  const initial = { clientMsgID: 'message-a', seq: 7 }
  const view = await render(<Probe id='group-a' message={initial} />)
  expect(mockFetchReaders).toHaveBeenCalledTimes(1)
  expect(mockFetchReaders).toHaveBeenCalledWith(session, 'http://chat', 'group-a', 'message-a', 7)

  await view.rerender(<Probe id='group-a' message={initial} />)
  expect(mockFetchReaders).toHaveBeenCalledTimes(1)
  await view.rerender(<Probe id='group-a' message={{ clientMsgID: 'message-a', seq: 8 }} />)
  expect(mockFetchReaders).toHaveBeenCalledTimes(2)
  await act(async () => {
    resolveOld({ members: [], readCount: 0, unreadCount: 3, excludedJoinedLater: 1 })
  })

  expect(sync).toHaveBeenCalledTimes(1)
  expect(sync).toHaveBeenCalledWith('group-a', 'message-a', 2, 0, { readInfo: undefined, userID: 'me', imToken: 'im', chatToken: 'chat' })
})

it('does not request readers for non-group or unsynchronized messages', async () => {
  const view = await render(<Probe id='direct' message={{ clientMsgID: 'message-b', seq: 9 }} enabled={false} />)
  await view.rerender(<Probe id='direct' message={{ clientMsgID: 'message-b', seq: 0 }} />)
  await view.rerender(<Probe id='group' message={{ clientMsgID: 'message-c', seq: 9 }} readInfo={{ readCount: 2, unreadCount: 0 }} />)
  expect(mockFetchReaders).not.toHaveBeenCalled()
})

it('ignores an HTTP reader result when a newer receipt changes the cached read-info reference', async () => {
  let resolveRequest!: (result: ReaderResult) => void
  mockFetchReaders.mockImplementationOnce(() => new Promise(resolve => {
    resolveRequest = resolve
  }))
  const message = { clientMsgID: 'message-race', seq: 10 }
  const view = await render(<Probe id='group-race' message={message} />)
  await view.rerender(<Probe id='group-race' message={message} readInfo={{ readCount: 2, unreadCount: 0 }} />)
  await act(async () => {
    resolveRequest({ members: [], readCount: 1, unreadCount: 2, excludedJoinedLater: 0 })
  })
  expect(sync).not.toHaveBeenCalled()
})

it('retries a failed readers lookup once and rechecks cached counts on foreground refresh', async () => {
  mockFetchReaders.mockRejectedValueOnce(new Error('temporary outage'))
  mockFetchReaders.mockRejectedValueOnce(new Error('still unavailable'))
  const view = await render(<Probe id='group-retry' message={{ clientMsgID: 'message-retry', seq: 12 }} />)
  await act(async () => new Promise(resolve => setTimeout(resolve, 300)))
  expect(mockFetchReaders).toHaveBeenCalledTimes(2)
  expect(sync).not.toHaveBeenCalled()

  mockFetchReaders.mockResolvedValueOnce({ members: [], readCount: 1, unreadCount: 2, excludedJoinedLater: 0 })
  await view.rerender(<Probe id='group-retry' message={{ clientMsgID: 'message-retry', seq: 12 }} readInfo={{ readCount: 0, unreadCount: 3 }} refreshToken={1} />)
  expect(mockFetchReaders).toHaveBeenCalledTimes(3)
  expect(sync).toHaveBeenCalledWith('group-retry', 'message-retry', 1, 2, { readInfo: { readCount: 0, unreadCount: 3 }, userID: 'me', imToken: 'im', chatToken: 'chat' })
})

it('serializes a foreground reader refresh behind an in-flight lookup', async () => {
  let finishInitial!: (result: ReaderResult) => void
  mockFetchReaders.mockImplementationOnce(() => new Promise(resolve => {
    finishInitial = resolve
  }))
  mockFetchReaders.mockResolvedValueOnce({ members: [], readCount: 1, unreadCount: 2, excludedJoinedLater: 0 })
  const message = { clientMsgID: 'message-serial', seq: 13 }
  const view = await render(<Probe id='group-serial' message={message} />)
  await view.rerender(<Probe id='group-serial' message={message} refreshToken={1} />)
  expect(mockFetchReaders).toHaveBeenCalledTimes(1)
  await act(async () => finishInitial({ members: [], readCount: 0, unreadCount: 3, excludedJoinedLater: 0 }))
  expect(mockFetchReaders).toHaveBeenCalledTimes(2)
  expect(sync).toHaveBeenCalledTimes(1)
  expect(sync).toHaveBeenCalledWith('group-serial', 'message-serial', 1, 2, { readInfo: undefined, userID: 'me', imToken: 'im', chatToken: 'chat' })
})

it('clears the bounded retry timer when the reader screen is disabled', async () => {
  jest.useFakeTimers()
  const schedule = jest.spyOn(globalThis, 'setTimeout')
  const cancel = jest.spyOn(globalThis, 'clearTimeout')
  try {
    mockFetchReaders.mockRejectedValueOnce(new Error('temporary outage'))
    const view = await render(<Probe id='group-unmount-retry' message={{ clientMsgID: 'message-unmount-retry', seq: 14 }} />)
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })
    const retryIndex = schedule.mock.calls.findIndex(call => call[1] === 250)
    expect(retryIndex).toBeGreaterThanOrEqual(0)
    const retryTimer = schedule.mock.results[retryIndex].value as ReturnType<typeof setTimeout>
    await view.rerender(<Probe id='group-unmount-retry' message={{ clientMsgID: 'message-unmount-retry', seq: 14 }} enabled={false} />)
    expect(cancel).toHaveBeenCalledWith(retryTimer)
  } finally {
    jest.restoreAllMocks()
    jest.useRealTimers()
  }
})
