import { afterEach, expect, it, jest } from '@jest/globals'
import { notifyChatEntryReady, waitForChatEntry } from './chat-entry'

afterEach(() => {
  jest.useRealTimers()
})
it('only releases the matching account and conversation after list readiness', async () => {
  const entry = waitForChatEntry('account-a', 'one')
  let settled = false
  void entry.ready.then(() => {
    settled = true
  })
  notifyChatEntryReady('account-b', 'one')
  notifyChatEntryReady('account-a', 'two')
  await Promise.resolve()
  expect(settled).toBe(false)
  notifyChatEntryReady('account-a', 'one')
  expect(await entry.ready).toBe(true)
})
it('cancels a superseded entry and does not cache old readiness', async () => {
  const first = waitForChatEntry('a', 'one')
  first.cancel()
  expect(await first.ready).toBe(false)
  const next = waitForChatEntry('a', 'one')
  notifyChatEntryReady('a', 'one')
  expect(await next.ready).toBe(true)
})
it('bounds preloading so a failed native preload cannot trap navigation', async () => {
  jest.useFakeTimers()
  const entry = waitForChatEntry('a', 'one')
  jest.advanceTimersByTime(1500)
  expect(await entry.ready).toBe(false)
})
