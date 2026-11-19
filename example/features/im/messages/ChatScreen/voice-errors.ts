import { reportError } from '../../application/store'
import { ProductError } from '../../shared/product-error.ts'

/** The recorder's timeouts, worded for the user; anything else is reported as it is. */
export function reportVoiceRecordingError (error: unknown) {
  const code = (error as { code?: string } | null)?.code
  if (code === 'VOICE_RECORDER_START_TIMEOUT') {
    reportError(new ProductError('recording.micTimeout'))
    return
  }
  if (code === 'VOICE_RECORDER_STOP_TIMEOUT') {
    reportError(new ProductError('recording.stopTimeout'))
    return
  }
  reportError(error)
}
