import { expect, it, jest } from '@jest/globals'
import { act, renderHook } from '@testing-library/react-native'
import { useMessageLocation } from './useMessageLocation'

const mockEnsureMessageLoaded = jest.fn<(...args: any[]) => Promise<unknown>>()
jest.mock('../application/store', () => ({ ensureMessageLoaded: (...args: any[]) => mockEnsureMessageLoaded(...args), reportError: jest.fn() }))

it('loads a quote target before scrolling to it', async () => {
  let resolveLoad!: () => void
  mockEnsureMessageLoaded.mockImplementationOnce(() => new Promise(resolve => {
    resolveLoad = () => resolve(undefined)
  }))
  const view = await renderHook(() => useMessageLocation('chat-1'))
  const scrollToMessage = jest.fn()
  view.result.current.chatRef.current = { scrollToMessage } as any

  await act(() => view.result.current.requestLocation('message-1'))
  expect(mockEnsureMessageLoaded).toHaveBeenCalledWith('chat-1', 'message-1', expect.any(Function))
  expect(scrollToMessage).not.toHaveBeenCalled()
  await act(async () => resolveLoad())
  await act(async () => new Promise(resolve => setTimeout(resolve, 260)))
  expect(scrollToMessage).toHaveBeenCalledWith('message-1', { animated: true, isHighlighted: true })
})

it('allows the same quote to be located again', async () => {
  jest.useFakeTimers()
  mockEnsureMessageLoaded.mockResolvedValue(undefined)
  const view = await renderHook(() => useMessageLocation('chat-1'))
  const scrollToMessage = jest.fn()
  view.result.current.chatRef.current = { scrollToMessage } as any

  await act(async () => view.result.current.requestLocation('message-1'))
  await act(() => jest.advanceTimersByTime(250))
  await act(async () => view.result.current.requestLocation('message-1'))
  await act(() => jest.advanceTimersByTime(250))

  expect(mockEnsureMessageLoaded).toHaveBeenCalledTimes(2)
  expect(scrollToMessage).toHaveBeenCalledTimes(2)
  jest.useRealTimers()
})

it('ignores a location load that finishes after unmount', async () => {
  let resolveLoad!: () => void
  mockEnsureMessageLoaded.mockImplementationOnce(() => new Promise(resolve => {
    resolveLoad = () => resolve(undefined)
  }))
  const view = await renderHook(() => useMessageLocation('chat-1'))
  const scrollToMessage = jest.fn()
  view.result.current.chatRef.current = { scrollToMessage } as any
  await act(() => view.result.current.requestLocation('message-1'))
  const isActive = mockEnsureMessageLoaded.mock.calls[0][2]
  await view.unmount()
  expect(isActive()).toBe(false)
  await act(async () => resolveLoad())
  expect(scrollToMessage).not.toHaveBeenCalled()
})
