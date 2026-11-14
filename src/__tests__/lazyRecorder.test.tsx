import { renderHook } from '@testing-library/react-native'

import { expoAudio } from '../components/VoiceMessageInput/recorder'
import { useLazyRecorder } from '../components/VoiceMessageInput/useLazyRecorder'

jest.mock('../components/VoiceMessageInput/recorder', () => ({
  expoAudio: { AudioModule: {}, RecordingPresets: { HIGH_QUALITY: { extension: '.webm' } } },
  platformRecordingOptions: (options: unknown) => options,
  releaseRecorder: (recorder: { release?: () => void } | null) => recorder?.release?.(),
}))

it('lazily creates and reuses the Expo 58 web recorder, then releases it on unmount', async () => {
  const release = jest.fn()
  const construct = jest.fn()
  expoAudio.AudioModule = {
    AudioRecorderWeb: class {
      release = release
      constructor (options: unknown) {
        construct(options) 
      }
    },
  }
  const { result, unmount } = await renderHook(useLazyRecorder)
  expect(construct).not.toHaveBeenCalled()
  const recorder = result.current.getRecorder()
  expect(result.current.getRecorder()).toBe(recorder)
  expect(construct).toHaveBeenCalledTimes(1)
  expect(construct).toHaveBeenCalledWith(expect.objectContaining({ isMeteringEnabled: true }))
  await unmount()
  expect(release).toHaveBeenCalledTimes(1)
})

it('continues using the native AudioRecorder constructor when it exists', async () => {
  const native = jest.fn()
  const web = jest.fn()
  expoAudio.AudioModule = {
    AudioRecorder: class {
      constructor () {
        native() 
      } 
    },
    AudioRecorderWeb: class {
      constructor () {
        web() 
      } 
    },
  }
  const { result } = await renderHook(useLazyRecorder)
  result.current.getRecorder()
  expect(native).toHaveBeenCalledTimes(1)
  expect(web).not.toHaveBeenCalled()
})
