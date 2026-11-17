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
const mockRun = (callback: (current: () => boolean) => unknown) => callback(() => true)
const mockFocusCallbacks: (() => void)[] = []

jest.mock('../application/store', () => ({
  openConversation: jest.fn(),
  useOpenIM: () => ({
    session: { userID: 'me', imToken: 'token' },
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
jest.mock('../shared/useTask', () => ({ useTask: () => ({
  busy: false,
  error: '',
  run: mockRun,
}) }))
jest.mock('../ui/primitives', () => {
  const Native = require('react-native')
  return { ProductAvatar: (props: { group?: boolean, size: number }) => <Native.View testID='call-history-avatar' {...props} /> }
})
jest.mock('../ui/ProductPage', () => ({
  ProductPage: ({ children, title, right, backHref }: { children: React.ReactNode, title: string, right?: React.ReactNode, backHref?: string }) => {
    const Native = require('react-native')
    return <Native.View><Native.Text>{title}</Native.Text><Native.Text testID='call-history-back-href'>{backHref || ''}</Native.Text>{right}{children}</Native.View>
  },
  ProductEmpty: ({ title }: { title: string }) => {
    const Native = require('react-native')
    return <Native.Text>{title}</Native.Text>
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

it('keeps call history back navigation in the Me section', async () => {
  const view = await render(<CallHistoryScreen />)
  expect(view.getByTestId('call-history-back-href').props.children).toBe('/(tabs)/me')
})
