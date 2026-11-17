import type { LayoutChangeEvent } from 'react-native'
import { afterEach, beforeEach, expect, it, jest } from '@jest/globals'
import { act, renderHook } from '@testing-library/react-native'
import { useMessageListLayout } from './useMessageListLayout'

jest.mock('../application/store', () => ({ reportError: jest.fn() }))
let frames: Map<number, FrameRequestCallback>
let nextFrame: number
beforeEach(() => {
  frames = new Map()
  nextFrame = 0
  jest.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(callback => {
    const id = ++nextFrame
    frames.set(id, callback)
    return id
  })
  jest.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(id => {
    if (typeof id === 'number')
      frames.delete(id)
  })
})
afterEach(() => {
  jest.restoreAllMocks()
})
const layout = (width: number, height = 600) => ({ nativeEvent: { layout: { x: 0, y: 0, width, height } } }) as LayoutChangeEvent
async function flushFrame () {
  const pending = [...frames.values()]
  frames.clear()
  await act(() => pending.forEach(callback => callback(0)))
}
it('remeasures only width changes after bubble reflow and keeps the same list ref', async () => {
  const clearCaches = jest.fn()
  const { result } = await renderHook(useMessageListLayout)
  const ref = result.current.messagesContainerRef
  ref.current = { clearCaches } as unknown as NonNullable<typeof ref.current>
  await act(() => result.current.onLayout(layout(920)))
  await act(() => result.current.onLayout(layout(920, 400)))
  expect(frames.size).toBe(0)
  await act(() => result.current.onLayout(layout(390)))
  await flushFrame()
  expect(clearCaches).not.toHaveBeenCalled()
  await flushFrame()
  expect(clearCaches).toHaveBeenCalledWith({ mode: 'sizes' })
  expect(clearCaches).toHaveBeenCalledTimes(1)
  expect(result.current.messagesContainerRef).toBe(ref)
  await act(() => result.current.onLayout(layout(390)))
  expect(frames.size).toBe(0)
})
it('coalesces resize frames and cancels pending measurement on unmount', async () => {
  const clearCaches = jest.fn()
  const { result, unmount } = await renderHook(useMessageListLayout)
  const ref = result.current.messagesContainerRef
  ref.current = { clearCaches } as unknown as NonNullable<typeof ref.current>
  await act(() => result.current.onLayout(layout(920)))
  await act(() => result.current.onLayout(layout(600)))
  await act(() => result.current.onLayout(layout(390)))
  expect(frames.size).toBe(1)
  await flushFrame()
  await unmount()
  expect(frames.size).toBe(0)
  await flushFrame()
  expect(clearCaches).not.toHaveBeenCalled()
})

it('buffers two viewports and updates on height-only changes without clearing rows', async () => {
  const { result } = await renderHook(useMessageListLayout)
  await act(() => result.current.onReady())
  await act(() => result.current.onTransitionEnd())
  await flushFrame()
  await flushFrame()
  await act(() => result.current.onLayout(layout(390, 700)))
  expect(result.current.drawDistance).toBe(1400)
  await act(() => result.current.onLayout(layout(390, 400)))
  expect(result.current.drawDistance).toBe(800)
  expect(frames.size).toBe(0)
  await act(() => result.current.onLayout(layout(390, 0)))
  expect(result.current.drawDistance).toBe(800)
  await act(() => result.current.onLayout(layout(390, 2000)))
  expect(result.current.drawDistance).toBe(2400)
})

it('builds only the viewport first and expands the normal fling buffer after the push', async () => {
  const { result } = await renderHook(useMessageListLayout)
  await act(() => result.current.onLayout(layout(390, 700)))
  expect(result.current.drawDistance).toBe(0)
  await act(() => result.current.onReady())
  await act(() => result.current.onTransitionEnd())
  await flushFrame()
  await flushFrame()
  expect(result.current.drawDistance).toBe(1400)
})

it('keeps the first viewport while the page slides in and grows after the push ends', async () => {
  const { result } = await renderHook(useMessageListLayout)
  await act(() => result.current.onLayout(layout(390, 700)))
  await act(() => result.current.onReady())
  await flushFrame()
  await flushFrame()
  expect(result.current.drawDistance).toBe(0)
  await act(() => result.current.onTransitionEnd())
  await flushFrame()
  await flushFrame()
  expect(result.current.drawDistance).toBe(1400)
})

it('grows after the push already ended before the list was ready', async () => {
  const { result } = await renderHook(useMessageListLayout)
  await act(() => result.current.onLayout(layout(390, 700)))
  await act(() => result.current.onTransitionEnd())
  expect(frames.size).toBe(0)
  await act(() => result.current.onReady())
  await flushFrame()
  await flushFrame()
  expect(result.current.drawDistance).toBe(1400)
})

it('grows at once when the user starts scrolling during the push', async () => {
  const { result } = await renderHook(useMessageListLayout)
  await act(() => result.current.onLayout(layout(390, 700)))
  await act(() => result.current.onReady())
  expect(result.current.drawDistance).toBe(0)
  await act(() => result.current.onScrollBeginDrag())
  expect(result.current.drawDistance).toBe(1400)
  await act(() => result.current.onTransitionEnd())
  await flushFrame()
  await flushFrame()
  expect(result.current.drawDistance).toBe(1400)
})

it('grows anyway when no push end arrives', async () => {
  jest.useFakeTimers({ doNotFake: ['requestAnimationFrame', 'cancelAnimationFrame'] })
  try {
    const { result } = await renderHook(useMessageListLayout)
    await act(() => result.current.onLayout(layout(390, 700)))
    await act(() => result.current.onReady())
    expect(result.current.drawDistance).toBe(0)
    await act(() => jest.advanceTimersByTime(700))
    expect(result.current.drawDistance).toBe(1400)
  } finally {
    jest.useRealTimers()
  }
})

it('shares the measured viewport width with rows before their own layout callbacks', async () => {
  const { result } = await renderHook(useMessageListLayout)
  await act(() => result.current.onLayout(layout(390)))
  expect(result.current.width).toBe(390)
  await act(() => result.current.onLayout(layout(920)))
  expect(result.current.width).toBe(920)
  await act(() => result.current.onLayout(layout(0)))
  expect(result.current.width).toBe(920)
})
