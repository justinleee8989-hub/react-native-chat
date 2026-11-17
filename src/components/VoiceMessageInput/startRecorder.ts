export const WEB_RECORDER_START_TIMEOUT_MS = 15000

export type VoiceRecorderErrorCode = 'VOICE_RECORDER_START_TIMEOUT' | 'VOICE_RECORDER_STOP_TIMEOUT'

export class VoiceRecorderError extends Error {
  readonly code: VoiceRecorderErrorCode

  constructor (code: VoiceRecorderErrorCode) {
    super(code === 'VOICE_RECORDER_START_TIMEOUT' ? 'Voice recorder startup timed out' : 'Voice recorder stop timed out')
    this.name = 'VoiceRecorderError'
    this.code = code
  }
}

export class RecorderStartCancelled extends Error {
  constructor () {
    super('Voice recorder startup cancelled')
    this.name = 'RecorderStartCancelled'
  }
}

/** Bounds permission and preparation waits and lets an explicit cancel settle them early. */
export function awaitRecorderStart<T> (operation: Promise<T>, timeoutMs: number, cancelled: Promise<never>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new VoiceRecorderError('VOICE_RECORDER_START_TIMEOUT')), timeoutMs)
  })
  return Promise.race([operation, timeout, cancelled]).finally(() => {
    if (timer)
      clearTimeout(timer)
  })
}
