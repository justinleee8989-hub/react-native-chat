import React from 'react'
import { Platform } from 'react-native'
import { AudioSession, registerGlobals, VideoTrack } from '@livekit/react-native'
import { Track, type Participant, type TrackPublication } from 'livekit-client'
registerGlobals()
export async function prepareAudio () {
  await AudioSession.startAudioSession()
}
export async function releaseAudio () {
  await AudioSession.stopAudioSession()
}
export async function setCallSpeaker (enabled: boolean) {
  const outputs = await AudioSession.getAudioOutputs()
  const desired =
    Platform.OS === 'ios'
      ? enabled
        ? 'force_speaker'
        : 'default'
      : enabled
        ? 'speaker'
        : ['earpiece', 'headset', 'bluetooth'].find(output => outputs.includes(output))
  if (!desired || !outputs.includes(desired))
    throw new Error(enabled ? '当前设备没有可用扬声器' : '当前设备没有可用听筒或耳机')
  await AudioSession.selectAudioOutput(desired)
}
export function MediaTrack ({
  publication,
  participant,
}: {
  publication: TrackPublication
  participant: Participant
  audible?: boolean
}) {
  if (publication.kind !== Track.Kind.Video)
    return null
  return (
    <VideoTrack
      trackRef={{ participant, publication, source: publication.source }}
      style={{ width: '100%', height: 240 }}
    />
  )
}
