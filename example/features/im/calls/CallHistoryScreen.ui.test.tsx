import React from 'react'
import { beforeEach, expect, it, jest } from '@jest/globals'
import { act, render, waitFor } from '@testing-library/react-native'
import { callAuthority } from './authority-api'
import CallHistoryScreen from './CallHistoryScreen'

const mockRecord = {
  room: 'imcall-room-1',
  caller: 'me',
  groupID: 'group-1',
  status: 'missed',
  created: 1_700_000_000_000,
  ended: 1_700_000_001_000,
  expires: 1_700_000_030_000,
  members: {},
}
// Each test signs in afresh, so the list remembered for an account never leaks between tests.
let mockAccount = 0
const mockRun = async (callback: (current: () => boolean) => unknown) => {
  try {
    await callback(() => true)
    mockTask.hasSucceeded = true
  } catch {}
}
const mockFocusCallbacks: (() => void)[] = []

jest.mock('../application/store', () => ({
  openConversation: jest.fn(),
  useOpenIM: () => ({
    session: { userID: 'me', imToken: `token-${mockAccount}` },
    config: { chat: 'https://chat.example' },
    conversations: [{ conversationID: 'group-conversation', groupID: 'group-1', showName: 'QA 群' }],
  }),
}))
jest.mock('expo-router', () => ({
  useFocusEffect: (callback: () => void) => {
    mockFocusCallbacks.push(callback)
  },
}))
jest.mock('../auth/LoginScreen', () => ({ __esModule: true, default: () => null }))
jest.mock('../groups/group-ui', () => ({
  HeaderAction: ({ title }: { title: string }) => {
    const Native = require('react-native')
    return <Native.Text>{title}</Native.Text>
  },
  ProductHint: ({ children }: { children: React.ReactNode }) => {
    const Native = require('react-native')
    return <Native.Text>{children}</Native.Text>
  },
}))
let mockTask = { busy: false, error: '', hasSucceeded: false }
jest.mock('../shared/useTask', () => ({ useTask: () => ({ ...mockTask, run: mockRun }) }))
jest.mock('../ui/primitives', () => {
  const Native = require('react-native')
  return { ProductAvatar: (props: { group?: boolean, size: number }) => <Native.View testID='call-history-avatar' {...props} /> }
})
jest.mock('../ui/ProductPage', () => ({
  ProductPage: ({ children, title, right, root, initialLoading }: { children: React.ReactNode, title: string, right?: React.ReactNode, root?: boolean, initialLoading?: boolean }) => {
    const Native = require('react-native')
    return <Native.View><Native.Text>{title}</Native.Text>{root && <Native.Text>root</Native.Text>}{right}{initialLoading ? <Native.Text>skeleton</Native.Text> : children}</Native.View>
  },
  ProductEmpty: ({ title, subtitle }: { title: string, subtitle?: string }) => {
    const Native = require('react-native')
    return <Native.Text>{title}{subtitle}</Native.Text>
  },
}))
jest.mock('../ui/theme', () => ({ useProductTheme: () => ({ text: '#111', text2: '#555', text3: '#777', danger: '#f00', line: '#ddd' }) }))
jest.mock('./authority-api', () => ({ __esModule: true, callAuthority: jest.fn(async () => [mockRecord]) }))
jest.mock('./CallControls', () => ({ startConversationCall: jest.fn() }))

async function focusHistory () {
  const focus = mockFocusCallbacks.at(-1)
  if (focus)
    await act(async () => {
      focus()
      await Promise.resolve()
    })
}

beforeEach(() => {
  mockFocusCallbacks.length = 0
  mockTask = { busy: false, error: '', hasSucceeded: false }
  mockAccount++
  jest.mocked(callAuthority).mockImplementation(async () => [mockRecord])
})

it('matches group call history avatar and row text hierarchy', async () => {
  const view = await render(<CallHistoryScreen />)
  await focusHistory()
  await waitFor(() => expect(view.getByText('QA 群')).toBeTruthy())

  const avatar = view.getByTestId('call-history-avatar')
  expect(avatar.props.group).toBe(true)
  expect(avatar.props.size).toBe(44)
  expect(view.getByText('QA 群').props.style).toEqual(expect.objectContaining({ fontWeight: '600', lineHeight: 22 }))
  expect(view.getByText('群通话 · 未接通话').props.style).toEqual(expect.objectContaining({ lineHeight: 18 }))
})

it('refreshes call history when the page regains focus', async () => {
  await render(<CallHistoryScreen />)
  await focusHistory()
  await waitFor(() => expect(callAuthority).toHaveBeenCalledTimes(1))

  await focusHistory()
  await waitFor(() => expect(callAuthority).toHaveBeenCalledTimes(2))
})

it('is the root page of the 通话 section', async () => {
  const view = await render(<CallHistoryScreen />)
  expect(view.getByText('通话')).toBeTruthy()
  expect(view.getByText('root')).toBeTruthy()
})

it('draws the list skeleton, not the empty state, until the first answer', async () => {
  const view = await render(<CallHistoryScreen />)
  expect(view.getByText('skeleton')).toBeTruthy()
  expect(view.queryByText('暂无通话记录')).toBeNull()
})

it('says the call service is off and stops asking on focus', async () => {
  const { CallServiceUnavailableError } = jest.requireActual<typeof import('./errors')>('./errors')
  jest.mocked(callAuthority).mockImplementation(async () => {
    throw new CallServiceUnavailableError()
  })
  const view = await render(<CallHistoryScreen />)
  await focusHistory()
  await waitFor(() => expect(view.getByText(/通话服务未启用/)).toBeTruthy())
  expect(view.queryByText('skeleton')).toBeNull()
  await focusHistory()
  await focusHistory()
  expect(callAuthority).toHaveBeenCalledTimes(1)
})

it('remembers the call service is off when the page is visited again', async () => {
  const { CallServiceUnavailableError } = jest.requireActual<typeof import('./errors')>('./errors')
  jest.mocked(callAuthority).mockImplementation(async () => {
    throw new CallServiceUnavailableError()
  })
  const first = await render(<CallHistoryScreen />)
  await focusHistory()
  await waitFor(() => expect(first.getByText(/通话服务未启用/)).toBeTruthy())
  first.unmount()
  mockFocusCallbacks.length = 0
  const again = await render(<CallHistoryScreen />)
  expect(again.getByText(/通话服务未启用/)).toBeTruthy()
  await focusHistory()
  expect(callAuthority).toHaveBeenCalledTimes(1)
})
