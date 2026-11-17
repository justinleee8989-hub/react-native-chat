import React from 'react'
import { act, fireEvent, render } from '@testing-library/react-native'
import { VoiceMessageInput } from '../components/VoiceMessageInput'

let mockStartPromise: Promise<void> | undefined
jest.mock('../components/RecordButton', () => {
  const ReactModule = require('react')
  const Native = require('react-native')
  return {
    RecordButton: (props: any) => {
      const onStart = () => {
        mockStartPromise = props.onStart()
      }
      return ReactModule.createElement(Native.View, null,
        ReactModule.createElement(Native.Pressable, { testID: 'start', onPress: onStart }, ReactModule.createElement(Native.Text, null, 'Start')),
        ReactModule.createElement(Native.Pressable, { testID: 'cancel', onPress: () => props.onFinish(true) }, ReactModule.createElement(Native.Text, null, 'Cancel')))
    },
  }
})

jest.mock('../components/VoiceMessageInput/recorder', () => {
  const permission: { resolve?: (value: { granted: boolean }) => void } = {}
  const stop: { resolve?: () => void } = {}
  const stopPromise = new Promise<void>(resolve => {
    stop.resolve = resolve
  })
  const recorder = {
    prepareToRecordAsync: jest.fn(async () => {}),
    record: jest.fn(),
    stop: jest.fn(() => stopPromise),
    release: jest.fn(),
    uri: 'file://note.m4a',
    getStatus: () => ({ metering: -20 }),
  }
  const expoAudio = {
    RecordingPresets: { HIGH_QUALITY: {} },
    AudioModule: {
      AudioRecorder: class {
        constructor () {
          return recorder
        }
      },
      requestRecordingPermissionsAsync: () => new Promise(resolve => {
        permission.resolve = resolve
      }),
    },
    setAudioModeAsync: jest.fn(async () => {}),
    useAudioRecorder: jest.fn(),
  }
  return {
    expoAudio,
    normalizeMetering: () => 0.5,
    platformRecordingOptions: (options: unknown) => options,
    releaseAudioSession: jest.fn(),
    releaseRecorder: jest.fn(),
    stopRecorderQuietly: jest.fn(),
    viewOnceFields: () => null,
    __test: { permission, stop, stopPromise, recorder },
  }
})

it('settles cancel during permission and ignores a late permission grant', async () => {
  mockStartPromise = undefined
  const view = await render(<VoiceMessageInput />)
  await fireEvent.press(view.getByTestId('start'))
  expect(mockStartPromise).toEqual(expect.any(Promise))
  await fireEvent.press(view.getByTestId('cancel'))

  const test = require('../components/VoiceMessageInput/recorder').__test
  expect(test.recorder.stop).not.toHaveBeenCalled()
  let startSettled = false
  mockStartPromise?.then(() => {
    startSettled = true
  })
  await act(async () => Promise.resolve())
  expect(startSettled).toBe(true)

  await act(async () => test.permission.resolve?.({ granted: true }))
  await act(async () => Promise.resolve())
  expect(test.recorder.record).not.toHaveBeenCalled()
  expect(test.recorder.prepareToRecordAsync).not.toHaveBeenCalled()
})
