import React, { useEffect, useRef } from 'react'
import type { Participant, TrackPublication } from 'livekit-client'
export async function prepareAudio () {}
export async function releaseAudio () {}
export function MediaTrack ({ publication, participant }: { publication: TrackPublication, participant: Participant }) {
  const host = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const track = publication.track
    const target = host.current
    if (!track || !target)
      return
    const element = track.attach()
    element.style.width = '100%'
    element.style.maxHeight = '280px'
    if (element instanceof HTMLVideoElement)
      element.playsInline = true
    if (participant.isLocal)
      element.muted = true
    target.appendChild(element)
    return () => {
      track.detach(element)
      element.remove()
    }
  }, [publication, publication.track, participant])
  return <div ref={host} />
}
