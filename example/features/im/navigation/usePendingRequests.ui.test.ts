import { beforeEach, expect, it, jest } from '@jest/globals'
import { act, renderHook, waitFor } from '@testing-library/react-native'
import { usePendingRequests } from './usePendingRequests'
const mockFriends = jest.fn<(offset: number) => Promise<{ handleResult: number }[]>>()
const mockGroups = jest.fn<(offset: number) => Promise<{ handleResult: number }[]>>()
let mockEvent: (() => void) | undefined
let mockSession: { userID: string, imToken: string } | undefined
jest.mock('../application/store', () => ({ useOpenIM: () => ({ session: mockSession }) }))
jest.mock('../application/directory', () => ({ contactDirectoryEvents: ['friend'], directory: { requests: (_received: boolean, offset: number) => mockFriends(offset) }, subscribeDirectory: (_events: string[], callback: () => void) => {
  mockEvent = callback; return () => {
    mockEvent = undefined
  }
} }))
jest.mock('../application/group-management', () => ({ groupApplicationEvents: ['group'], groupManagement: { requests: (_received: boolean, offset: number) => mockGroups(offset) } }))
beforeEach(() => {
  mockSession = { userID: 'self', imToken: 'token' }
  mockFriends.mockResolvedValue([{ handleResult: 0 }, { handleResult: 1 }])
  mockGroups.mockResolvedValue([{ handleResult: 0 }, { handleResult: -1 }])
})
it('counts pending incoming requests across every page and refreshes SDK changes', async () => {
  mockFriends.mockImplementation(async offset => offset === 0 ? Array.from({ length: 30 }, () => ({ handleResult: 0 })) : [{ handleResult: 0 }])
  const view = await renderHook(() => usePendingRequests())
  await waitFor(() => expect(view.result.current).toBe(32))
  mockFriends.mockResolvedValue([])
  mockGroups.mockResolvedValue([])
  await act(async () => mockEvent?.())
  await waitFor(() => expect(view.result.current).toBe(0))
})
it('clears counts when the session ends', async () => {
  const view = await renderHook(() => usePendingRequests())
  await waitFor(() => expect(view.result.current).toBe(2))
  mockSession = undefined
  await view.rerender({})
  expect(view.result.current).toBe(0)
})
