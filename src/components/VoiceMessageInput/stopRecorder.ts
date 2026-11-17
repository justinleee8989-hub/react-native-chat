import { VoiceRecorderError } from './startRecorder'

const WEB_RECORDER_STOP_TIMEOUT_MS = 8000

/**
 * Waits for the recorder to flush its final data, but bounds Web stop calls.
 * expo-audio's Web recorder resolves stop() only from `dataavailable`; some
 * browser/device paths can omit that event and otherwise leave the composer
 * permanently settling.
 */
export function stopRecorderWithTimeout (recorder: { stop: () => Promise<void> }, timeoutMs: number) {
  const stopped = Promise.resolve().then(() => recorder.stop())
  if (timeoutMs <= 0)
    return stopped

  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new VoiceRecorderError('VOICE_RECORDER_STOP_TIMEOUT')), timeoutMs)
  })
  return Promise.race([stopped, timeout]).finally(() => {
    if (timer)
      clearTimeout(timer)
  })
}

export { WEB_RECORDER_STOP_TIMEOUT_MS }
