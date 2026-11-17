import React from 'react'
import { Pressable, Text, View } from 'react-native'
import { act, fireEvent } from '@testing-library/react-native'
import { createRecordingMeter } from '../components/recordingMeter'
import { VoiceMessageInput } from '../components/VoiceMessageInput'
import { render } from './renderWithGestureRoot'

let mockMeter: ReturnType<typeof createRecordingMeter>
let mockStart: jest.Mock
let mockStopTake: jest.Mock
jest.mock('../components/VoiceMessageInput/useVoiceTake', () => ({ useVoiceTake: () => ({
  phase: 'recording',
  meter: mockMeter,
  labels: {},
  preview: null,
  isViewOnce: false,
  toggleViewOnce: jest.fn(),
  start: (...args: unknown[]) => mockStart(...args),
  stopTake: (...args: unknown[]) => mockStopTake(...args),
  setIsLocked: jest.fn(),
  resume: jest.fn(),
  sendPreview: jest.fn(),
  onSlideProgress: jest.fn(),
}) }))

jest.mock('../components/RecordButton', () => {
  const ReactModule = require('react')
  const Native = require('react-native')
  return { RecordButton: () => ReactModule.createElement(Native.Text, null, 'default-record-button') }
})

describe('VoiceMessageInput custom recorder control', () => {
  beforeEach(() => {
    mockMeter = createRecordingMeter()
    mockStart = jest.fn(async () => {})
    mockStopTake = jest.fn(async () => {})
  })

  it('passes recording state and elapsed time, and routes start, cancel, and send through the take', async () => {
    const view = await render(<VoiceMessageInput renderControl={({ isRecording, elapsed, onStart, onCancel, onSend }) => <View>
      <Text>{`${isRecording}:${elapsed}`}</Text>
      <Pressable testID='start' onPress={onStart} />
      <Pressable testID='cancel' onPress={onCancel} />
      <Pressable testID='send' onPress={onSend} />
    </View>}
    />)

    expect(view.getByText('true:0')).toBeTruthy()
    await act(() => mockMeter.elapsed.set(3250))
    expect(view.getByText('true:3250')).toBeTruthy()
    await fireEvent.press(view.getByTestId('start'))
    await fireEvent.press(view.getByTestId('cancel'))
    await fireEvent.press(view.getByTestId('send'))
    expect(mockStart).toHaveBeenCalledTimes(1)
    expect(mockStopTake).toHaveBeenNthCalledWith(1, 'cancel')
    expect(mockStopTake).toHaveBeenNthCalledWith(2, 'send')
    expect(view.queryByText('default-record-button')).toBeNull()
  })

  it('keeps the SDK record button when no custom control is provided', async () => {
    const view = await render(<VoiceMessageInput />)
    expect(view.getByText('default-record-button')).toBeTruthy()
  })
})
