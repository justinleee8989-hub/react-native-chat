import React from 'react'
import { Pressable as MockPressable, Text as MockText } from 'react-native'
import { afterEach, expect, it, jest } from '@jest/globals'
import { act, fireEvent, render } from '@testing-library/react-native'
import SessionGuard from './SessionGuard'
import { StartupReadinessProvider, useStartupReadiness } from './StartupReadiness'

const mockSession = { userID: 'qa', imToken: 'qa-token' }
let mockState: any = { initialized: true, session: mockSession, busy: true }
let mockSegments = ['(tabs)', 'chats']
const mockReplace = jest.fn()
jest.mock('../application/store', () => ({ useOpenIM: () => mockState }))
jest.mock('expo-router', () => ({ useSegments: () => mockSegments, useRootNavigationState: () => ({ key: 'root' }), useRouter: () => ({ replace: mockReplace }) }))
jest.mock('expo-splash-screen', () => ({ hide: jest.fn() }))
jest.mock('./StartupScreen', () => ({ StartupScreen: ({ onContinue }: { onContinue?: () => void }) => <><MockText>启动页</MockText>{onContinue && <MockPressable accessibilityLabel='继续进入' onPress={onContinue} />}</> }))
function Home () {
  const { markReady } = useStartupReadiness()
  return <MockPressable accessibilityLabel='首屏布局完成' onPress={() => markReady(mockState.session)} />
}
const App = () => <StartupReadinessProvider><Home /><SessionGuard /></StartupReadinessProvider>
afterEach(() => {
  jest.useRealTimers()
  mockState = { initialized: true, session: mockSession, busy: true }
  mockSegments = ['(tabs)', 'chats']
})
it('keeps startup over an authenticated home until its real content has laid out', async () => {
  jest.useFakeTimers()
  const view = await render(<App />)
  expect(view.getByText('启动页')).toBeTruthy()
  await fireEvent.press(view.getByLabelText('首屏布局完成'))
  await act(async () => {
    jest.advanceTimersByTime(100)
  })
  expect(view.queryByText('启动页')).toBeNull()
  mockState = { ...mockState, session: { userID: 'another', imToken: 'other' } }
  await view.rerender(<App />)
  expect(view.getByText('启动页')).toBeTruthy()
})
it('lets a slow home be entered explicitly without an automatic timed flash', async () => {
  jest.useFakeTimers()
  const view = await render(<App />)
  await act(async () => {
    jest.advanceTimersByTime(15000)
  })
  expect(view.getByText('启动页')).toBeTruthy()
  await fireEvent.press(view.getByLabelText('继续进入'))
  await act(async () => {
    jest.advanceTimersByTime(100)
  })
  expect(view.queryByText('启动页')).toBeNull()
})
it('does not wait for a home list on the login page or a deep link', async () => {
  mockState = { initialized: true, session: undefined, busy: false }
  mockSegments = ['auth', 'login']
  const view = await render(<App />)
  expect(view.queryByText('启动页')).toBeNull()
  mockState = { initialized: true, session: mockSession, busy: false }
  mockSegments = ['chats', '[id]']
  await view.rerender(<App />)
  expect(view.queryByText('启动页')).toBeNull()
})
