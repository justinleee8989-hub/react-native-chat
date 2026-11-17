import { useEffect as mockEffect } from 'react'
import { afterEach, expect, it, jest } from '@jest/globals'
import { act, renderHook } from '@testing-library/react-native'
import { isChatEntryReady, notifyChatEntryReady } from './chat-entry'
import { useChatEntry, useChatEntryReady } from './useChatEntry'

let mockFocused = true
afterEach(() => {
  mockFocused = true
})
const mockReport = jest.fn()
const mockPrefetch = jest.fn()
const mockHistory = jest.fn<() => Promise<void>>(async () => {})
jest.mock('../application/store', () => ({ prefetchConversationHistory: () => mockHistory(), reportError: (error: unknown) => mockReport(error) }))
jest.mock('expo-router', () => ({
  useRouter: () => ({ prefetch: mockPrefetch }),
  useFocusEffect: (effect: () => void | (() => void)) => mockEffect(() => mockFocused ? effect() : undefined, [effect, mockFocused]),
}))
it('keeps the source screen until the actual native list reports ready', async () => {
  const open = jest.fn()
  const view = await renderHook(() => useChatEntry('qa', open))
  await act(async () => view.result.current.open('one'))
  expect(mockPrefetch).toHaveBeenCalledWith('/chats/one')
  expect(open).not.toHaveBeenCalled()
  await act(() => notifyChatEntryReady('qa', 'one'))
  expect(open).toHaveBeenCalledWith('/chats/one')
})
it('does not navigate an old account or superseded conversation after readiness', async () => {
  const open = jest.fn()
  const view = await renderHook<ReturnType<typeof useChatEntry>, { account: string }>(({ account }) => useChatEntry(account, open), { initialProps: { account: 'qa' } })
  await act(async () => view.result.current.open('one'))
  await act(async () => view.result.current.open('two'))
  await act(() => notifyChatEntryReady('qa', 'one'))
  expect(open).not.toHaveBeenCalled()
  await view.rerender({ account: 'other' })
  await act(() => notifyChatEntryReady('qa', 'two'))
  expect(open).not.toHaveBeenCalled()
})

it('enters cached history without starting a refresh before navigation', async () => {
  const open = jest.fn()
  const view = await renderHook(() => useChatEntry('qa', open, () => true))
  await act(async () => view.result.current.open('cached'))
  expect(mockHistory).not.toHaveBeenCalled()
  expect(mockPrefetch).toHaveBeenCalledWith('/chats/cached')
  await act(() => notifyChatEntryReady('qa', 'cached'))
  expect(open).toHaveBeenCalledWith('/chats/cached')
})

it('reuses readiness of a still-mounted history page without waiting for another onReady event', async () => {
  const page = await renderHook(() => useChatEntryReady('mounted-qa', 'history', true))
  await act(() => page.result.current())
  const open = jest.fn()
  const entry = await renderHook(() => useChatEntry('mounted-qa', open, () => true))
  await act(() => entry.result.current.prepare('history'))
  await act(async () => entry.result.current.open('history'))
  expect(open).toHaveBeenCalledWith('/chats/history')
  expect(mockPrefetch).not.toHaveBeenCalled()
  await page.unmount()
  open.mockClear()
  await act(async () => entry.result.current.open('history'))
  expect(open).not.toHaveBeenCalled()
  await entry.unmount()
})
it('starts the native page while an uncached SDK history read is still pending', async () => {
  let finish!: () => void
  mockHistory.mockImplementationOnce(() => new Promise<void>(resolve => {
    finish = resolve
  }))
  const open = jest.fn()
  const entry = await renderHook(() => useChatEntry('parallel-qa', open))
  await act(async () => entry.result.current.open('history'))
  expect(mockPrefetch).toHaveBeenCalledWith('/chats/history')
  expect(open).not.toHaveBeenCalled()
  await act(() => finish())
  await act(() => notifyChatEntryReady('parallel-qa', 'history'))
  expect(open).toHaveBeenCalledWith('/chats/history')
})

it('prepares one cached route while the list is idle without fetching or navigating', async () => {
  jest.useFakeTimers()
  try {
    const open = jest.fn()
    const view = await renderHook(() => useChatEntry('warm-qa', open, () => true, 'recent'))
    await act(async () => {
      jest.advanceTimersByTime(200)
    })
    expect(mockPrefetch).toHaveBeenCalledWith('/chats/recent')
    expect(mockHistory).not.toHaveBeenCalled()
    expect(open).not.toHaveBeenCalled()
    await view.unmount()
  } finally {
    jest.useRealTimers()
  }
})
it('prepares on press-in without navigating or changing the selected conversation', async () => {
  const open = jest.fn()
  const view = await renderHook(() => useChatEntry('touch-qa', open, () => true))
  await act(() => view.result.current.prepare('touch'))
  expect(mockPrefetch).toHaveBeenCalledWith('/chats/touch')
  expect(open).not.toHaveBeenCalled()
  expect(mockHistory).not.toHaveBeenCalled()
})

it('deduplicates press-in and repeated clicks until navigation takes focus', async () => {
  const open = jest.fn()
  const view = await renderHook(() => useChatEntry('repeat', open, () => true))
  await act(() => {
    view.result.current.prepare('one'); view.result.current.prepare('one')
  })
  await act(async () => {
    view.result.current.open('one'); view.result.current.open('one')
  })
  expect(mockPrefetch).toHaveBeenCalledTimes(1)
  await act(() => notifyChatEntryReady('repeat', 'one'))
  await act(async () => view.result.current.open('one'))
  expect(open).toHaveBeenCalledTimes(1)
})
it('prepares a conversation again after another one replaced its off-screen page', async () => {
  const open = jest.fn()
  const view = await renderHook(() => useChatEntry('replace', open, () => true))
  const prefetched = (href: string) => mockPrefetch.mock.calls.filter(call => call[0] === href).length
  await act(() => view.result.current.prepare('first'))
  await act(() => view.result.current.prepare('second'))
  await act(() => view.result.current.prepare('first'))
  expect(prefetched('/chats/first')).toBe(2)
  expect(prefetched('/chats/second')).toBe(1)
})
it('does not navigate to a blank page when layout readiness times out', async () => {
  jest.useFakeTimers()
  try {
    const open = jest.fn()
    const view = await renderHook(() => useChatEntry('timeout', open, () => true))
    await act(async () => view.result.current.open('one'))
    await act(async () => {
      jest.advanceTimersByTime(1500)
    })
    expect(open).not.toHaveBeenCalled()
    expect(mockReport).toHaveBeenCalled()
    await view.unmount()
  } finally {
    jest.useRealTimers()
  }
})

it('revokes readiness immediately on blur even while the old page stays mounted', async () => {
  mockFocused = false
  const page = await renderHook(() => useChatEntryReady('lifecycle', 'one', true))
  await act(() => page.result.current())
  expect(isChatEntryReady('lifecycle', 'one')).toBe(true)
  mockFocused = true
  await page.rerender(undefined)
  mockFocused = false
  await page.rerender(undefined)
  expect(isChatEntryReady('lifecycle', 'one')).toBe(false)
  await page.unmount()
})
