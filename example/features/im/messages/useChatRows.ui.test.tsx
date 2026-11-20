import { expect, it, jest } from '@jest/globals'
import type { IMessage } from '@kesha-antonov/react-native-chat'
import { renderHook } from '@testing-library/react-native'
import type { IMMessage } from '@/features/im/domain/types'
import { encodeSignal } from '../calls/signaling'
import { useChatRows } from './useChatRows'

jest.mock('expo-router', () => ({ useRouter: () => ({ push: () => {} }) }))
jest.mock('@/features/im/application/store', () => ({ calls: { subscribe: () => () => {}, snapshot: () => mockCallState }, loadServerHistory: () => Promise.resolve(), reportError: () => {}, retryMessage: () => Promise.resolve() }))
jest.mock('./MessageCustomContent', () => ({ MessageCustomContent: () => null }))
jest.mock('./ProductMessage', () => ({ ProductBubble: () => null, ProductMessage: () => null }))

const mockCallState: { outcomes: Record<string, unknown> } = { outcomes: {} }
const room = 'imcall-11111111-1111-4111-8111-111111111111'
const message = (clientMsgID: string, content: string, sendTime: number): IMMessage => ({
  clientMsgID, contentType: 101, status: 2, sendID: 'me', recvID: 'peer', sendTime, textElem: { content },
} as IMMessage)

const rows = async (rawMessages: IMMessage[]) => (await renderHook(() => useChatRows({
  id: 'si_me_peer',
  rawMessages,
  extras: { map: (m: IMessage) => m, react: () => {} },
  selfID: 'me',
  isGroup: false,
  requestCall: () => {},
  onRevoke: () => {},
}))).result.current.messages

it('keeps a call on one list row when its final record replaces the invitation', async () => {
  const text = message('text', 'hello', 1000)
  const invite = message('invite', encodeSignal({ room, expires: 45000, kind: 'invite' }), 2000)
  const cancel = message('cancel', encodeSignal({ room, expires: 45000, kind: 'cancel' }), 3000)
  const ringing = await rows([invite, text])
  const ended = await rows([cancel, invite, text])
  expect(ringing.map(row => [row._id, row.listKey])).toEqual([['invite', `call:${room}`], ['text', undefined]])
  expect(ended.map(row => [row._id, row.listKey])).toEqual([['cancel', `call:${room}`], ['text', undefined]])
})

it('gives the call key to one row only when more of the call stay visible', async () => {
  const invite = message('invite', encodeSignal({ room, expires: 45000, kind: 'invite' }), 2000)
  const accept = message('accept', encodeSignal({ room, expires: 45000, kind: 'accept' }), 3000)
  expect((await rows([accept, invite])).map(row => row.listKey)).toEqual([`call:${room}`, undefined])
})
