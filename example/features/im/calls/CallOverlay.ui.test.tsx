import React from 'react'
import { AppState } from 'react-native'
import { beforeEach, expect, it, jest } from '@jest/globals'
import { fireEvent, render } from '@testing-library/react-native'
import { calls } from '../application/store'
import CallOverlay from './CallOverlay'
const mockSnapshot = { active: undefined, notice: '通话已取消', error: '' }
jest.mock('../application/store', () => ({ calls: { snapshot: () => mockSnapshot, subscribe: () => () => {}, tick: () => {}, finish: jest.fn(() => Promise.resolve()), accept: jest.fn(() => Promise.resolve()), setMediaPreference: jest.fn(), dismiss: () => {} }, useOpenIM: () => ({ session: { userID: 'me' }, conversations: [{ conversationID: 'c', userID: 'peer', showName: '真实联系人' }] }) }))
jest.mock('expo-router', () => ({ useRouter: () => ({ push: () => {} }) }))
jest.mock('./useRingtone', () => ({ useRingtone: () => () => {} }))
jest.mock('../shared/useTask', () => ({ useTask: () => ({ run: (action: (...args: any[]) => unknown) => action(...(action.length ? [() => true] : [])), error: '', busy: false }) }))
jest.mock('../ui/ProductModal', () => ({ ProductModal: ({ visible, children }: { visible: boolean, children: React.ReactNode }) => visible ? children : null }))
jest.mock('./CallPresentation', () => ({ CallPresentation: ({ name, status, children }: { name: string, status: string, children: React.ReactNode }) => {
  const { Text, View } = require('react-native'); return <View><Text>{name}</Text><Text>{status}</Text>{children}</View>
}, CallControl: ({ label, onPress, disabled }: { label: string, onPress: () => void, disabled?: boolean }) => {
  const { Pressable, Text } = require('react-native'); return <Pressable accessibilityRole='button' accessibilityLabel={label} disabled={disabled} onPress={onPress}><Text>{label}</Text></Pressable>
} }))
it('returns directly to chat after a normal call cancellation', async () => {
  const view = await render(<CallOverlay />)
  expect(view.queryByText('知道了')).toBeNull()
})
it('keeps an actionable acknowledgement for real call errors', async () => {
  mockSnapshot.error = '无法确认服务端通话状态'
  const view = await render(<CallOverlay />)
  expect(view.getByText('知道了')).toBeTruthy()
  mockSnapshot.error = ''
})

beforeEach(() => {
  jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: () => {} })
  mockSnapshot.active = undefined
  mockSnapshot.notice = '通话已取消'
  mockSnapshot.error = ''
  jest.mocked(calls.accept).mockClear()
  jest.mocked(calls.finish).mockClear()
})
it('keeps the server disconnection notice visible', async () => {
  mockSnapshot.notice = '连接中断，通话已结束'
  const view = await render(<CallOverlay />)
  expect(view.getByText('知道了')).toBeTruthy()
  mockSnapshot.notice = '通话已取消'
})

const mockCall = (phase: 'incoming' | 'outgoing') => ({
  room: 'imcall-room-1',
  expires: Date.now() + 30_000,
  kind: 'invite' as const,
  peer: 'peer',
  name: '真实联系人',
  phase,
  media: { microphone: true, camera: false, speaker: true },
})

it('routes incoming accept and reject buttons to their real call actions', async () => {
  mockSnapshot.active = mockCall('incoming') as any
  const view = await render(<CallOverlay />)
  expect(view.getByText('邀请你进行音视频通话')).toBeTruthy()
  await fireEvent.press(view.getByRole('button', { name: '接听' }))
  expect(calls.accept).toHaveBeenCalledTimes(1)
  await fireEvent.press(view.getByRole('button', { name: '拒接' }))
  expect(calls.finish).toHaveBeenCalledWith('reject')
})

it('routes an outgoing cancel button to the cancel call action', async () => {
  mockSnapshot.active = mockCall('outgoing') as any
  const view = await render(<CallOverlay />)
  expect(view.getByText('正在呼叫…')).toBeTruthy()
  await fireEvent.press(view.getByRole('button', { name: '取消' }))
  expect(calls.finish).toHaveBeenCalledWith('cancel')
})
