import type { MediaPreferences } from './server-controller'
interface MediaRoom {
  localParticipant: {
    trackPublications?: Map<string, { track?: { stop(): void } }>
    setMicrophoneEnabled(enabled: boolean): Promise<unknown>
    setCameraEnabled(enabled: boolean): Promise<unknown>
  }
}
/** Capture can finish after navigation. Immediately release tracks in that case. */
export async function applyInitialMedia (room: MediaRoom, media: MediaPreferences, current: () => boolean) {
  if (!current())
    return
  await room.localParticipant.setMicrophoneEnabled(media.microphone)
  if (!current()) {
    stopLocalCapture(room)
    await room.localParticipant.setMicrophoneEnabled(false)
    return
  }
  await room.localParticipant.setCameraEnabled(media.camera)
  if (!current()) {
    stopLocalCapture(room)
    await Promise.all([room.localParticipant.setMicrophoneEnabled(false), room.localParticipant.setCameraEnabled(false)])
  }
}

export function stopLocalCapture (room: MediaRoom) {
  for (const publication of room.localParticipant.trackPublications?.values() || [])
    publication.track?.stop()
}
