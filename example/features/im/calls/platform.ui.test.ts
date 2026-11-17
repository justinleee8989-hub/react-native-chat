import { Platform } from 'react-native'
import { expect, it, jest } from '@jest/globals'
import { AudioSession } from '@livekit/react-native'
import { setCallSpeaker } from './platform'
jest.mock('@livekit/react-native', () => ({ registerGlobals: () => {}, VideoTrack: () => null, AudioSession: { getAudioOutputs: jest.fn(), selectAudioOutput: jest.fn(), startAudioSession: jest.fn(), stopAudioSession: jest.fn() } }))
jest.mock('livekit-client', () => ({ Track: { Kind: { Video: 'video' } } }))
it('selects actual Android speaker and earpiece routes; fails without a receiver', async () => {
  const previous = Platform.OS
  Platform.OS = 'android'
  try {
    jest.mocked(AudioSession.getAudioOutputs).mockResolvedValue(['speaker', 'earpiece'])
    await setCallSpeaker(true)
    expect(AudioSession.selectAudioOutput).toHaveBeenLastCalledWith('speaker')
    await setCallSpeaker(false)
    expect(AudioSession.selectAudioOutput).toHaveBeenLastCalledWith('earpiece')
    jest.mocked(AudioSession.getAudioOutputs).mockResolvedValue(['speaker'])
    await expect(setCallSpeaker(false)).rejects.toThrow('当前设备没有可用听筒或耳机')
  } finally {
    Platform.OS = previous
  }
})
it('uses supported iOS default and forced speaker routes', async () => {
  const previous = Platform.OS
  Platform.OS = 'ios'
  try {
    jest.mocked(AudioSession.getAudioOutputs).mockResolvedValue(['default', 'force_speaker'])
    await setCallSpeaker(false)
    expect(AudioSession.selectAudioOutput).toHaveBeenLastCalledWith('default')
    await setCallSpeaker(true)
    expect(AudioSession.selectAudioOutput).toHaveBeenLastCalledWith('force_speaker')
  } finally {
    Platform.OS = previous
  }
})
