import React, { forwardRef } from 'react'

import { useStore } from '../../store'
import { RecordButton } from '../RecordButton'
import { RecordingMeter, sameNumber } from '../recordingMeter'
import { isVoiceResumeAvailable, isVoiceTrimAvailable } from '../voiceEditing'
import { VoiceMessageInputHandle, VoiceMessageInputProps } from './types'
import { useVoiceTake } from './useVoiceTake'

export { formatElapsed } from './formatElapsed'
export { RecordedVoicePreview } from './RecordedVoicePreview'
export type { RecordedVoicePreviewProps } from './RecordedVoicePreview'
export { isVoiceRecordingAvailable } from './recorder'
export type {
  VoiceMessageInputHandle,
  VoiceMessageInputProps,
  VoiceRecordingControlProps,
  VoiceRecordingPreview,
  VoiceRecordingState
} from './types'

/**
 * Hold-to-record voice notes. Hold the mic to record, slide left
 * to cancel, slide up to lock for hands-free recording, or release to send. A
 * locked take can be paused into a preview to replay before sending. A
 * take of `minDurationMs` or less is discarded.
 *
 * This component owns the recorder; the button and its gesture are
 * `RecordButton`, and the bar - timer, "slide to cancel", the preview - is
 * drawn by the InputToolbar via `onStateChange`, so it can span the full
 * width of the input row. Only mounted when expo-audio is available, so its
 * hooks always run in a stable order.
 */
function VoiceMessageInputInner (
  { config, onSend, onStateChange, onTap, hint, onQuickRelease, slideProgressValue, onExit, renderControl }: VoiceMessageInputProps,
  ref: React.Ref<VoiceMessageInputHandle>
) {
  const {
    phase,
    meter,
    labels,
    preview,
    isViewOnce,
    toggleViewOnce,
    start,
    stopTake,
    setIsLocked,
    resume,
    sendPreview,
    onSlideProgress,
  } = useVoiceTake({ config, onSend, onStateChange }, ref)

  if (renderControl)
    return <CustomVoiceControl
      meter={meter}
      isRecording={phase === 'recording' || phase === 'locked'}
      renderControl={renderControl}
      onStart={() => start()}
      onCancel={() => stopTake('cancel')}
      onSend={() => stopTake('send')}
    />

  return (
    <RecordButton
      mode='voice'
      phase={phase}
      levelStore={meter.level}
      onTap={onTap}
      onStart={() => start()}
      onFinish={cancelled => stopTake(cancelled ? 'cancel' : 'send')}
      onLock={() => setIsLocked(true)}
      onPause={() => stopTake('preview')}
      onResume={preview && isVoiceResumeAvailable() ? resume : undefined}
      pauseHint={isVoiceTrimAvailable() ? labels.pauseToTrimOrReplay : null}
      onSend={preview ? sendPreview : () => stopTake('send')}
      onSlideProgress={onSlideProgress}
      slideProgressValue={slideProgressValue}
      onExit={onExit}
      hint={hint}
      onQuickRelease={onQuickRelease}
      onToggleViewOnce={config?.isViewOnceEnabled ? toggleViewOnce : undefined}
      isViewOnce={isViewOnce}
    />
  )
}

// Only custom controls subscribe here: the default button keeps its meter-driven animation.
function CustomVoiceControl ({ meter, renderControl, ...controls }: {
  meter: RecordingMeter
  renderControl: NonNullable<VoiceMessageInputProps['renderControl']>
  isRecording: boolean
  onStart: () => Promise<void>
  onCancel: () => void | Promise<void>
  onSend: () => void | Promise<void>
}) {
  const elapsed = useStore(meter.elapsed, sameNumber, 0)
  return renderControl({ ...controls, elapsed })
}

export const VoiceMessageInput = forwardRef(VoiceMessageInputInner)
