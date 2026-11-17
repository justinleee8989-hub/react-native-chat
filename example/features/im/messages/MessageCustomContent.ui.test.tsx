import React from 'react'
import { expect, it, jest } from '@jest/globals'
import { render } from '@testing-library/react-native'
import { formatCallInvitation } from '../calls/invitation'
import { encodeSignal } from '../calls/signaling'
import type { IMMessage } from '../domain/types'
import { MessageCustomContent } from './MessageCustomContent'

const mockCall = jest.fn<(props: unknown) => null>(() => null)
const mockInvite = jest.fn<(props: unknown) => null>(() => null)
const mockRich = jest.fn<(props: unknown) => null>(() => null)
jest.mock('../calls/CallMessage', () => ({ CallMessage: (props: unknown) => mockCall(props) }))
jest.mock('../calls/CallControls', () => ({ JoinCall: (props: unknown) => mockInvite(props) }))
jest.mock('./RichMessages', () => ({ RichMessage: (props: unknown) => mockRich(props) }))
const room = 'imcall-11111111-1111-4111-8111-111111111111'
const base: IMMessage = { clientMsgID: 'qa', sendID: 'me', recvID: 'peer', sendTime: 100, status: 2, contentType: 101, textElem: { content: '普通消息' } }
const props = { self: 'me', onCall: jest.fn(), onError: jest.fn() }
it('does not mount call subscriptions or rich gestures for ordinary messages', async () => {
  await render(<MessageCustomContent {...props} message={base} />)
  expect(mockCall).not.toHaveBeenCalled()
  expect(mockInvite).not.toHaveBeenCalled()
  expect(mockRich).not.toHaveBeenCalled()
})
it('preserves real call records and legacy invitations', async () => {
  const message = { ...base, textElem: { content: encodeSignal({ room, expires: 45000, kind: 'cancel' }) } }
  const view = await render(<MessageCustomContent {...props} message={message} />)
  expect(mockCall).toHaveBeenCalledWith(expect.objectContaining({ message, onCall: props.onCall }))
  expect(mockInvite).not.toHaveBeenCalled()
  const text = formatCallInvitation({ room, expires: 45000 })
  await view.rerender(<MessageCustomContent {...props} message={{ ...base, textElem: { content: text } }} />)
  expect(mockInvite).toHaveBeenCalledWith(expect.objectContaining({ text, own: true }))
})
it.each([108, 109])('keeps type %s rich message actions', async contentType => {
  const message = { ...base, contentType }
  await render(<MessageCustomContent {...props} message={message} />)
  expect(mockRich).toHaveBeenCalledWith(expect.objectContaining({ message, own: true, onError: props.onError }))
})
