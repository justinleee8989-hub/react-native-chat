import React from 'react'
import { AppState } from 'react-native'
import { beforeEach, expect, it, jest } from '@jest/globals'
import { act, fireEvent, render } from '@testing-library/react-native'
import { ServerError } from '../shared/product-error'
import { showProductToast } from '../shared/ProductToast'
import CallScreen from './CallScreen'

const mockRouter = { canGoBack: jest.fn(() => true), back: jest.fn(), replace: jest.fn() }
const mockConnect = jest.fn(() => Promise.resolve())
const mockToken = jest.fn(() => Promise.resolve({ serverUrl: 'ws://rtc', token: 'call' }))
// Stable, as the real store and useTask are: new ones each render would loop.
const mockCallState: { active?: object } = { active: undefined }
const mockTask = { run: (action: (current: () => boolean) => unknown) => Promise.resolve(action(() => true)), error: '', busy: false }
let mockFocus = false
const mockKeepAlive = jest.fn()
const mockParams: { room: string, expires: string, managed?: string } = { room: 'imcall-00000000-0000-4000-8000-000000000001', expires: String(Date.now() + 600_000) }
type MockRoom = { state: string, remoteParticipants: Map<string, object>, handlers: Map<string, (() => void)[]> }
const mockRooms: MockRoom[] = []
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual<typeof import('react')>('react')
  return {
    useLocalSearchParams: () => mockParams,
    useRouter: () => mockRouter,
    // Off unless a test asks for it, so the page does not start connecting.
    useFocusEffect: (effect: () => void | (() => void)) => useEffect(() => mockFocus ? effect() : undefined, [effect]),
  }
})
jest.mock('livekit-client', () => ({
  RoomEvent: { ParticipantConnected: 'participantConnected', ParticipantDisconnected: 'participantDisconnected', ConnectionStateChanged: 'connectionStateChanged' },
  Room: class {
    state = 'disconnected'
    localParticipant = { isMicrophoneEnabled: false, isCameraEnabled: false, trackPublications: new Map(), identity: 'me' }
    remoteParticipants = new Map()
    handlers = new Map<string, (() => void)[]>()
    constructor () {
      mockRooms.push(this)
    }
    on (event: string, handler: () => void) {
      this.handlers.set(event, [...this.handlers.get(event) || [], handler])
    }
    off () {}
    connect = mockConnect
    disconnect () {
      return Promise.resolve()
    }
    startAudio () {
      return Promise.resolve()
    }
  },
}))
jest.mock('../application/store', () => ({
  calls: { snapshot: () => mockCallState, subscribe: () => () => {}, mediaReady: () => {}, peerJoined: () => {}, finish: () => Promise.resolve(), setMediaPreference: () => {} },
  useOpenIM: () => ({ session: { userID: 'me', imToken: 'session' }, config: { chat: 'http://chat' }, conversations: [] }),
}))
jest.mock('../auth/LoginScreen', () => () => null)
jest.mock('../shared/ProductToast', () => ({ ProductToast: () => null, showProductToast: jest.fn() }))
jest.mock('../shared/useTask', () => ({ useTask: () => mockTask }))
jest.mock('../ui/ProductModal', () => ({ ProductModal: ({ children }: { children: React.ReactNode }) => children }))
jest.mock('./CallPresentation', () => ({
  callConnectionLabel: () => 'call.preparing',
  CallPresentation: ({ children, status }: { children: React.ReactNode, status: string }) => {
    const { Text } = require('react-native'); return <>{status ? <Text>{status}</Text> : null}{children}</>
  },
  CallControl: ({ label, onPress }: { label: string, onPress: () => void }) => {
    const { Pressable, Text } = require('react-native'); return <Pressable accessibilityRole='button' onPress={onPress}><Text>{label}</Text></Pressable>
  },
}))
jest.mock('./platform', () => ({ MediaTrack: () => null, prepareAudio: () => Promise.resolve(), releaseAudio: () => Promise.resolve(), setCallSpeaker: () => Promise.resolve() }))
jest.mock('./useCallKeepAlive', () => ({ useCallKeepAlive: (call: unknown) => mockKeepAlive(call) }))
jest.mock('./token-api', () => ({ requestCallToken: () => mockToken() }))
jest.mock('./media-setup', () => ({ applyInitialMedia: () => Promise.resolve(), stopLocalCapture: () => {} }))

beforeEach(() => {
  jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: () => {} } as ReturnType<typeof AppState.addEventListener>)
  mockFocus = false
  mockRouter.canGoBack.mockReturnValue(true)
  mockRouter.back.mockClear()
  mockRouter.replace.mockClear()
  mockConnect.mockReset().mockResolvedValue(undefined)
  mockToken.mockReset().mockResolvedValue({ serverUrl: 'ws://rtc', token: 'call' })
  mockParams.expires = String(Date.now() + 600_000)
  delete mockParams.managed
  mockCallState.active = undefined
  mockRooms.length = 0
  jest.mocked(showProductToast).mockClear()
})

it('hangs up back to the page it came from', async () => {
  const view = await render(<CallScreen />)
  await fireEvent.press(view.getByText('挂断'))
  expect(mockRouter.back).toHaveBeenCalledTimes(1)
  expect(mockRouter.replace).not.toHaveBeenCalled()
})

it('hangs up to the chat list when the call page was opened on its own', async () => {
  mockRouter.canGoBack.mockReturnValue(false)
  const view = await render(<CallScreen />)
  await fireEvent.press(view.getByText('挂断'))
  expect(mockRouter.back).not.toHaveBeenCalled()
  expect(mockRouter.replace).toHaveBeenCalledWith('/(tabs)/chats')
})

it('leaves to the chat list when a call page opened on its own fails to connect', async () => {
  mockFocus = true
  mockRouter.canGoBack.mockReturnValue(false)
  mockConnect.mockRejectedValue(new Error('could not establish signal connection'))
  await render(<CallScreen />)
  await act(async () => {})
  expect(showProductToast).toHaveBeenCalledTimes(1)
  expect(mockRouter.back).not.toHaveBeenCalled()
  expect(mockRouter.replace).toHaveBeenCalledWith('/(tabs)/chats')
})

it('leaves, saying why, when the server will not let this user join the call', async () => {
  mockFocus = true
  mockToken.mockRejectedValue(new ServerError({ errCode: 1002, errMsg: 'no permission' }, 200))
  await render(<CallScreen />)
  await act(async () => {})
  expect(showProductToast).toHaveBeenCalledWith('通话已结束')
  expect(mockConnect).not.toHaveBeenCalled()
  expect(mockRouter.back).toHaveBeenCalledTimes(1)
})

it('leaves, saying why, when the invitation has expired', async () => {
  mockFocus = true
  mockParams.expires = String(Date.now() - 1000)
  await render(<CallScreen />)
  await act(async () => {})
  expect(showProductToast).toHaveBeenCalledWith('通话邀请已过期或无效，请重新发起')
  expect(mockToken).not.toHaveBeenCalled()
  expect(mockRouter.back).toHaveBeenCalledTimes(1)
})

it('says the other side lost connection while the server gives them time to come back', async () => {
  mockFocus = true
  mockParams.managed = '1'
  mockCallState.active = { room: mockParams.room, peer: 'peer', phase: 'connected', media: { microphone: true, camera: false, speaker: true } }
  const view = await render(<CallScreen />)
  await act(async () => {})
  const room = mockRooms[mockRooms.length - 1]
  const emit = async (event: string) => act(async () => room.handlers.get(event)?.forEach(handler => handler()))
  room.state = 'connected'
  await emit('participantDisconnected')
  expect(view.queryByText('对方网络中断，等待重连')).toBeNull()
  room.remoteParticipants.set('peer', { identity: 'peer', trackPublications: new Map() })
  await emit('participantConnected')
  room.remoteParticipants.clear()
  await emit('participantDisconnected')
  expect(view.getByText('对方网络中断，等待重连')).toBeTruthy()
  room.remoteParticipants.set('peer', { identity: 'peer', trackPublications: new Map() })
  await emit('participantConnected')
  expect(view.queryByText('对方网络中断，等待重连')).toBeNull()
})
it('keeps the call going in the background once its media connects, through reconnecting, until the room is gone', async () => {
  mockFocus = true
  mockParams.managed = '1'
  mockCallState.active = { room: mockParams.room, peer: 'peer', phase: 'connected', media: { microphone: true, camera: false, speaker: true } }
  await render(<CallScreen />)
  await act(async () => {})
  expect(mockKeepAlive).toHaveBeenLastCalledWith(undefined)
  const room = mockRooms[mockRooms.length - 1]
  // The status label is mocked to one text here, so a participant event renders the page again.
  const stateChanged = (state: string) => {
    room.state = state
    return act(async () => ['connectionStateChanged', 'participantConnected'].forEach(event => room.handlers.get(event)?.forEach(handler => handler())))
  }
  await stateChanged('connected')
  expect(mockKeepAlive).toHaveBeenLastCalledWith({ title: 'peer', microphone: false, camera: false })
  await stateChanged('reconnecting')
  expect(mockKeepAlive).toHaveBeenLastCalledWith({ title: 'peer', microphone: false, camera: false })
  await stateChanged('disconnected')
  expect(mockKeepAlive).toHaveBeenLastCalledWith(undefined)
})
