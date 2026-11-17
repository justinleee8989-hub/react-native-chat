import React from 'react'
import { Pressable, Text } from 'react-native'
import { fireEvent } from '@testing-library/react-native'
import { MessageAudio } from '../MessageAudio'
import { render } from './renderWithGestureRoot'

jest.mock('../optional', () => {
  const actual = jest.requireActual<any>('../optional')
  const mockPlayer = {
    pause: jest.fn(),
    play: jest.fn(),
    seekTo: jest.fn(),
    setPlaybackRate: jest.fn(),
  }
  return {
    ...actual,
    __player: mockPlayer,
    getExpoAudio: () => ({
      useAudioPlayer: () => mockPlayer,
      useAudioPlayerStatus: () => ({ playing: true, duration: 16, currentTime: 5 }),
    }),
  }
})

jest.mock('../components/WaveformPlayer', () => {
  const ReactModule = require('react')
  const Native = require('react-native')
  return {
    isWaveformAvailable: true,
    WaveformPlayer: () => ReactModule.createElement(Native.Text, null, 'waveform-default'),
  }
})

describe('MessageAudio custom player renderer', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('routes to the Expo player when a renderer is supplied and forwards live state and toggle', async () => {
    const view = await render(<MessageAudio
      currentMessage={{ _id: 'voice-1', text: '', createdAt: new Date(), user: { _id: 'peer' }, audio: 'file://note.m4a', duration: 16 }}
      renderPlayer={({ isPlaying, isDisabled, duration, currentTime, onToggle }) => <Pressable accessibilityRole='button' accessibilityState={{ disabled: isDisabled }} onPress={onToggle}><Text>{`${isPlaying}:${duration}:${currentTime}`}</Text></Pressable>}
    />)

    expect(view.queryByText('waveform-default')).toBeNull()
    expect(view.getByText('true:16:5')).toBeTruthy()
    await fireEvent.press(view.getByRole('button'))
    expect(require('../optional').__player.pause).toHaveBeenCalledTimes(1)
  })

  it('keeps the default waveform renderer when no custom renderer is provided', async () => {
    const view = await render(<MessageAudio currentMessage={{ _id: 'voice-default', text: '', createdAt: new Date(), user: { _id: 'peer' }, audio: 'file://note.m4a' }} />)
    expect(view.getByText('waveform-default')).toBeTruthy()
  })
})
