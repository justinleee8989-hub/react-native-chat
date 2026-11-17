import React, { useEffect, useRef } from 'react'
import {
  Track,
  type RemoteParticipant,
  type Participant,
  type TrackPublication,
} from 'livekit-client'
export async function prepareAudio () {}
export async function releaseAudio () {}
// Browsers do not expose earpiece routing; MediaTrack applies the playback gain.
export async function setCallSpeaker (enabled: boolean) {
  void enabled
}
export function MediaTrack ({
  publication,
  participant,
  audible = true,
}: {
  publication: TrackPublication
  participant: Participant
  audible?: boolean
}) {
  const host = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const track = publication.track
    const target = host.current
    if (!track || !target)
      return
    if (!participant.isLocal && publication.kind === Track.Kind.Audio)
      (participant as RemoteParticipant).setVolume(
        audible ? 1 : 0,
        publication.source === Track.Source.ScreenShareAudio
          ? Track.Source.ScreenShareAudio
          : Track.Source.Microphone
      )
    const element = track.attach()
    element.style.width = '100%'
    element.style.maxHeight = '280px'
    if (element instanceof HTMLVideoElement)
      element.playsInline = true
    // Remote audio stays muted at the element: LiveKit mixes it through WebAudio.
    if (participant.isLocal)
      element.muted = true
    target.appendChild(element)
    return () => {
      track.detach(element)
      element.remove()
    }
  }, [publication, publication.track, participant, audible])
  return <div ref={host} />
}
