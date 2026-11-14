import React from 'react'
import { AudioSession, registerGlobals, VideoTrack } from '@livekit/react-native'
import { Track, type Participant, type TrackPublication } from 'livekit-client'
registerGlobals()
export async function prepareAudio () {
  await AudioSession.startAudioSession() 
}
export async function releaseAudio () {
  await AudioSession.stopAudioSession() 
}
export function MediaTrack ({ publication, participant }: { publication: TrackPublication, participant: Participant }) {
  if (publication.kind !== Track.Kind.Video)
    return null
  return <VideoTrack trackRef={{ participant, publication, source: publication.source }} style={{ width: '100%', height: 240 }} />
}
