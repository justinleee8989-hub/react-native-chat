import React from 'react'
import { expect, it, jest } from '@jest/globals'
import { fireEvent, render } from '@testing-library/react-native'
import { CallMessage, CallMessageAction } from './CallMessage'
import { encodeSignal } from './signaling'
jest.mock('../ui/ProductIcon', () => ({ ProductIcon: () => null }))
jest.mock('../ui/theme', () => ({ useProductTheme: () => ({ text: '#111', onAccent: '#fff' }) }))
it('shows a callable result card with the terminal label', async () => {
  const view = await render(<CallMessage self='me' onCall={() => {}} message={{ clientMsgID: 'real-id', sendID: 'me', recvID: 'peer', contentType: 101, sendTime: 1000, status: 2, textElem: { content: encodeSignal({ room: 'imcall-11111111-1111-4111-8111-111111111111', expires: 45000, kind: 'cancel' }) } }} />)
  expect(view.getByText('已取消')).toBeTruthy()
  expect(view.getByRole('button', { name: '已取消，再次呼叫' })).toBeTruthy()
})

jest.mock('react-native-gesture-handler', () => ({ GestureDetector: ({ children }: { children: React.ReactNode }) => children, useTapGesture: (options: unknown) => options }))
it('accessibility activation honors disabled call actions', async () => {
  const press = jest.fn()
  const view = await render(<CallMessageAction label='加入通话' disabled onPress={press} />)
  await fireEvent(view.getByRole('button'), 'accessibilityTap')
  expect(press).not.toHaveBeenCalled()
  await view.rerender(<CallMessageAction label='加入通话' onPress={press} />)
  await fireEvent(view.getByRole('button'), 'accessibilityTap')
  expect(press).toHaveBeenCalledTimes(1)
})

const signalMessage = (kind: 'missed' | 'reject' | 'cancel', sendID = 'peer') => ({
  clientMsgID: `call-${kind}`,
  sendID,
  recvID: sendID === 'me' ? 'peer' : 'me',
  contentType: 101,
  sendTime: 1000,
  status: 2,
  textElem: { content: encodeSignal({ room: 'imcall-11111111-1111-4111-8111-111111111111', expires: 45000, kind }) },
})

it.each([
  ['missed', '未接通话'],
  ['reject', '对方已拒接'],
  ['cancel', '已取消'],
] as const)('shows the %s terminal call label', async (kind, label) => {
  const view = await render(<CallMessage self='me' onCall={jest.fn()} message={signalMessage(kind)} />)
  expect(view.getByText(label)).toBeTruthy()
})

it('shows connected call duration and invokes retry when pressed', async () => {
  const onCall = jest.fn()
  const room = 'imcall-11111111-1111-4111-8111-111111111111'
  const message = {
    ...signalMessage('cancel', 'me'),
    textElem: { content: encodeSignal({ version: 2, eventID: `rtc-terminal:${room}`, caller: 'me', callee: 'peer', status: 'ended', room, expires: 45000, kind: 'end', ended: 6000, connectedAt: 1000, durationSeconds: 5 }) },
  }
  const view = await render(<CallMessage self='me' onCall={onCall} message={message} />)
  expect(view.getByText('音视频通话 00:05')).toBeTruthy()
  await fireEvent.press(view.getByRole('button', { name: '音视频通话 00:05，再次呼叫' }))
  expect(onCall).toHaveBeenCalledTimes(1)
})
