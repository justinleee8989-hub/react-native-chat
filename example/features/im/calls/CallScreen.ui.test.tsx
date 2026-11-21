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
// Stable too: a new session each render would restart the call's connection.
const mockOpenIM = { session: { userID: 'me', imToken: 'session' }, config: { chat: 'http://chat' }, conversations: [] }
const mockCallState: { active?: object, notice?: string } = { active: undefined }
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
  useOpenIM: () => mockOpenIM,
}))
jest.mock('../auth/LoginScreen', () => () => null)
jest.mock('../shared/ProductToast', () => ({ ProductToast: () => null, showProductToast: jest.fn() }))
jest.mock('../shared/useTask', () => ({ useTask: () => mockTask }))
jest.mock('../ui/ProductModal', () => ({ ProductModal: ({ children }: { children: React.ReactNode }) => children }))
jest.mock('./CallPresentation', () => ({
  callConnectionLabel: () => 'call.preparing',
  CallPresentation: ({ children, status, media, stage, inset }: { children: React.ReactNode, status: string, media?: React.ReactNode, stage?: React.ReactNode, inset?: React.ReactNode }) => {
    const { Text } = require('react-native'); return <>{status ? <Text>{status}</Text> : null}{stage}{inset}{media}{children}</>
  },
  CallControl: ({ label, onPress }: { label: string, onPress: () => void }) => {
    const { Pressable, Text } = require('react-native'); return <Pressable accessibilityRole='button' onPress={onPress}><Text>{label}</Text></Pressable>
  },
}))
jest.mock('./platform', () => ({
  MediaTrack: ({ publication, layout }: { publication: { kind: string, trackSid: string }, layout?: string }) => {
    const { Text } = require('react-native'); return publication.kind === 'video' ? <Text>{`${layout || 'list'} ${publication.trackSid}`}</Text> : null
  }, prepareAudio: () => Promise.resolve(), releaseAudio: () => Promise.resolve(), setCallSpeaker: () => Promise.resolve() }))
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
  delete mockCallState.notice
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
it('says a dropped call on its page, then closes it by itself', async () => {
  mockFocus = true
  mockParams.managed = '1'
  mockCallState.active = { room: mockParams.room, peer: 'peer', phase: 'connected', media: { microphone: true, camera: false, speaker: true } }
  const view = await render(<CallScreen />)
  await act(async () => {})
  const room = mockRooms[mockRooms.length - 1]
  room.state = 'connected'
  await act(async () => room.handlers.get('connectionStateChanged')?.forEach(handler => handler()))
  jest.useFakeTimers()
  try {
    mockCallState.active = undefined
    mockCallState.notice = 'call.droppedEnded'
    await view.rerender(<CallScreen />)
    expect(view.getByText('连接中断，通话已结束')).toBeTruthy()
    expect(showProductToast).not.toHaveBeenCalled()
    expect(mockRouter.back).not.toHaveBeenCalled()
    await act(async () => jest.advanceTimersByTime(2000))
    expect(mockRouter.back).toHaveBeenCalledTimes(1)
  } finally {
    jest.useRealTimers()
  }
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
it('fills the page with the other camera, keeps your own in the corner, and drops a camera turned off', async () => {
  mockFocus = true
  mockParams.managed = '1'
  mockCallState.active = { room: mockParams.room, peer: 'peer', phase: 'connected', media: { microphone: true, camera: false, speaker: true } }
  const view = await render(<CallScreen />)
  await act(async () => {})
  const room = mockRooms[mockRooms.length - 1] as MockRoom & { localParticipant: { trackPublications: Map<string, object> } }
  const theirs: { kind: string, trackSid: string, isMuted: boolean, track?: object } = { kind: 'video', trackSid: 'TR_theirs', isMuted: false }
  const own = { kind: 'video', trackSid: 'TR_own', isMuted: false, track: {} }
  room.state = 'connected'
  room.remoteParticipants.set('peer', { identity: 'peer', trackPublications: new Map([['TR_theirs', theirs]]) })
  room.localParticipant.trackPublications.set('TR_own', own)
  // The status label is mocked to one text here, so a participant event renders the page again.
  const changed = () => act(async () => room.handlers.get('participantConnected')?.forEach(handler => handler()))
  // Theirs is published before it is subscribed: no video until it has a stream.
  await changed()
  expect(view.queryByText(/TR_theirs/)).toBeNull()
  expect(view.getByText('stage TR_own')).toBeTruthy()
  theirs.track = {}
  await changed()
  expect(view.getByText('stage TR_theirs')).toBeTruthy()
  expect(view.getByText('inset TR_own')).toBeTruthy()
  expect(view.queryByText('peer')).toBeNull()
  // A camera turned off stays published, muted: its last frame is not shown.
  theirs.isMuted = true
  await changed()
  expect(view.queryByText(/TR_theirs/)).toBeNull()
  expect(view.getByText('stage TR_own')).toBeTruthy()
  own.isMuted = true
  await changed()
  expect(view.queryByText(/TR_own/)).toBeNull()
  theirs.isMuted = false
  await changed()
  expect(view.getByText('stage TR_theirs')).toBeTruthy()
})
it('lists every camera in a group call', async () => {
  mockFocus = true
  mockParams.managed = '1'
  mockCallState.active = { room: mockParams.room, groupID: 'group', phase: 'connected', media: { microphone: true, camera: false, speaker: true } }
  const view = await render(<CallScreen />)
  await act(async () => {})
  const room = mockRooms[mockRooms.length - 1]
  room.state = 'connected'
  room.remoteParticipants.set('a', { identity: 'a', trackPublications: new Map([['TR_a', { kind: 'video', trackSid: 'TR_a', isMuted: false, track: {} }]]) })
  room.remoteParticipants.set('b', { identity: 'b', trackPublications: new Map([['TR_b', { kind: 'video', trackSid: 'TR_b', isMuted: true, track: {} }]]) })
  await act(async () => room.handlers.get('participantConnected')?.forEach(handler => handler()))
  expect(view.getByText('list TR_a')).toBeTruthy()
  expect(view.getByText('a')).toBeTruthy()
  expect(view.queryByText(/TR_b/)).toBeNull()
  expect(view.queryByText('b')).toBeNull()
})
