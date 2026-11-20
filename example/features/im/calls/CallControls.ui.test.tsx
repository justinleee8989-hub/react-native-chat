import { beforeEach, expect, it, jest } from '@jest/globals'
import { calls, sendTextChecked } from '../application/store'
import { startConversationCall } from './CallControls'

const mockCall = { room: 'imcall-00000000-0000-4000-8000-000000000001', expires: 1_700_000_900_000 }
let mockConnected: (connected: boolean) => void = () => {}
jest.mock('../application/store', () => ({
  calls: {
    snapshot: jest.fn(() => ({ active: undefined })),
    group: jest.fn(() => Promise.resolve(mockCall)),
    whenMediaReady: jest.fn(() => new Promise<boolean>(resolve => {
      mockConnected = resolve
    })),
    finish: jest.fn(() => Promise.resolve()),
    notifyError: jest.fn(),
  },
  sendTextChecked: jest.fn(() => Promise.resolve()),
  useOpenIM: () => ({}),
}))
jest.mock('expo-crypto', () => ({ randomUUID: () => '00000000-0000-4000-8000-000000000002' }))
// Only the call start is under test: the screens these come with are not rendered.
jest.mock('../shared/shared', () => ({ Action: () => null }))
jest.mock('../groups/group-ui', () => ({ ProductHint: () => null }))
jest.mock('./CallMessage', () => ({ CallMessageAction: () => null }))

const group = { groupID: 'group-1', showName: 'QA 群' }
const settle = () => new Promise(resolve => setTimeout(resolve, 0))

beforeEach(() => {
  jest.mocked(calls.snapshot).mockReturnValue({ active: undefined } as ReturnType<typeof calls.snapshot>)
  jest.mocked(calls.group).mockResolvedValue(mockCall as Awaited<ReturnType<typeof calls.group>>)
  jest.mocked(calls.whenMediaReady).mockImplementation(() => new Promise<boolean>(resolve => {
    mockConnected = resolve
  }))
  jest.mocked(sendTextChecked).mockResolvedValue(undefined as never)
})

it('invites the group only once the caller is connected to the call', async () => {
  await startConversationCall(group, 'group-conversation')
  await settle()
  expect(calls.whenMediaReady).toHaveBeenCalledWith(mockCall.room)
  expect(sendTextChecked).not.toHaveBeenCalled()

  mockConnected(true)
  await settle()
  expect(sendTextChecked).toHaveBeenCalledTimes(1)
  expect(jest.mocked(sendTextChecked).mock.calls[0][0]).toBe('group-conversation')
  expect(String(jest.mocked(sendTextChecked).mock.calls[0][1])).toContain(mockCall.room)
})

it('sends no invitation when the caller cannot connect', async () => {
  await startConversationCall(group, 'group-conversation')
  mockConnected(false)
  await settle()
  expect(sendTextChecked).not.toHaveBeenCalled()
  expect(calls.notifyError).not.toHaveBeenCalled()
})
