import React from 'react'
import { Platform } from 'react-native'
import { AudioSession, registerGlobals, VideoTrack } from '@livekit/react-native'
import { Track, type Participant, type TrackPublication } from 'livekit-client'
import { ProductError } from '../shared/product-error'
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
    throw new ProductError(enabled ? 'call.noSpeaker' : 'call.noEarpiece')
  await AudioSession.selectAudioOutput(desired)
}
export function MediaTrack ({
  publication,
  participant,
  layout,
}: {
  publication: TrackPublication
  participant: Participant
  audible?: boolean
  layout?: 'stage' | 'inset'
}) {
  if (publication.kind !== Track.Kind.Video)
    return null
  return (
    <VideoTrack
      trackRef={{ participant, publication, source: publication.source }}
      style={layout ? { width: '100%', height: '100%' } : { width: '100%', height: 240 }}
      // Android draws each video on its own surface: the corner one has to sit above the stage.
      zOrder={layout === 'inset' ? 1 : 0}
    />
  )
}
