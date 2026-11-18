import { reportError } from '../../application/store'

/** The recorder's timeouts, worded for the user; anything else is reported as it is. */
export function reportVoiceRecordingError (error: unknown) {
  const code = (error as { code?: string } | null)?.code
  if (code === 'VOICE_RECORDER_START_TIMEOUT') {
    reportError(new Error('麦克风启动超时，请检查浏览器和系统的麦克风权限'))
    return
  }
  if (code === 'VOICE_RECORDER_STOP_TIMEOUT') {
    reportError(new Error('录音结束超时，请重新录制'))
    return
  }
  reportError(error)
}
