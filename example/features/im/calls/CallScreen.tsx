import React, { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { AppState, Platform, Text, View } from 'react-native'
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import { Room, RoomEvent } from 'livekit-client'
import { calls, useOpenIM } from '../application/store'
import LoginScreen from '../auth/LoginScreen'
import { useTask } from '../shared/useTask'
import { ProductModal } from '../ui/ProductModal'
import { CallControl, CallPresentation, callConnectionLabel } from './CallPresentation'
import { callError } from './errors'
import { assertActiveInvitation } from './invitation'
import { applyInitialMedia, stopLocalCapture } from './media-setup'
import { MediaTrack, prepareAudio, releaseAudio, setCallSpeaker } from './platform'
import { requestCallToken } from './token-api'

export default function CallScreen () {
  const {
    room: roomID,
    expires,
    managed,
  } = useLocalSearchParams<{ room: string, expires: string, managed?: string }>()
  const { session, config } = useOpenIM()
  return session ? (
    <Call
      key={`${session.userID}:${session.imToken}:${roomID}`}
      roomID={roomID}
      managed={managed === '1'}
      expires={Number(expires)}
      session={session}
      chatURL={config.chat}
    />
  ) : (
    <LoginScreen />
  )
}
function Call ({
  roomID,
  expires,
  session,
  chatURL,
  managed,
}: {
  managed: boolean
  roomID: string
  expires: number
  session: NonNullable<ReturnType<typeof useOpenIM>['session']>
  chatURL: string
}) {
  const router = useRouter()
  const { conversations } = useOpenIM()
  const callState = useSyncExternalStore(calls.subscribe, calls.snapshot, calls.snapshot)
  const task = useTask()
  const { run } = task
  const [room] = useState(
    () =>
      new Room({
        adaptiveStream: true,
        dynacast: true,
        webAudioMix: Platform.OS === 'web',
        publishDefaults: { stopMicTrackOnMute: true },
      })
  )
  const [revision, setRevision] = useState(0)
  const connectedAt = callState.active?.room === roomID ? callState.active.connectedAt || 0 : 0
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    if (!connectedAt)
      return
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - connectedAt) / 1000)), 1000)
    return () => clearInterval(timer)
  }, [connectedAt])
  const [status, setStatus] = useState('准备连接')
  const mediaActive = useRef(false)
  useEffect(() => {
    if (managed && callState.active?.room !== roomID) {
      void room.disconnect().catch(() => {})
      router.back()
    }
  }, [managed, callState.active?.room, roomID, room, router])
  useFocusEffect(
    useCallback(() => {
      if (managed && calls.snapshot().active?.room !== roomID)
        return
      let active = true
      mediaActive.current = true
      const stop = () => {
        active = false
        calls.mediaReady(roomID, false)
        mediaActive.current = false
        stopLocalCapture(room)
        void room
          .disconnect()
          .finally(releaseAudio)
          .catch(() => {})
        if (managed && calls.snapshot().active?.room === roomID)
          void calls.finish('end').catch(() => {})
      }
      const appState = AppState.addEventListener('change', state => {
        if (state === 'background') {
          stop()
          setStatus('已离开通话，请返回聊天后重新加入')
        }
      })
      const changed = () => {
        if (active)
          setRevision(value => value + 1)
      }
      const stateChanged = () => {
        calls.mediaReady(roomID, active && room.state === 'connected')
        if (active)
          setStatus(callConnectionLabel(room.state))
      }
      const events = [
        RoomEvent.ParticipantConnected,
        RoomEvent.ParticipantDisconnected,
        RoomEvent.TrackSubscribed,
        RoomEvent.TrackUnsubscribed,
        RoomEvent.LocalTrackPublished,
        RoomEvent.LocalTrackUnpublished,
        RoomEvent.TrackMuted,
        RoomEvent.TrackUnmuted,
      ]
      events.forEach(event => room.on(event, changed))
      room.on(RoomEvent.ConnectionStateChanged, stateChanged)
      void run(async current => {
        assertActiveInvitation({ room: roomID, expires })
        const credentials = await requestCallToken(session, roomID, chatURL)
        if (!current() || !active)
          return
        await prepareAudio()
        if (!active) {
          await releaseAudio()
          return
        }
        await room.connect(credentials.serverUrl, credentials.token)
        if (!current() || !active) {
          await room.disconnect()
          return
        }
        const preferences = calls.snapshot().active?.media || {
          microphone: true,
          camera: false,
          speaker: true,
        }
        let mediaError: unknown
        try {
          await applyInitialMedia(
            room,
            preferences,
            () =>
              active &&
              current() &&
              mediaActive.current &&
              (!managed || calls.snapshot().active?.room === roomID)
          )
        } catch (error) {
          mediaError = error
        }
        if (active && current() && mediaActive.current)
          try {
            await setCallSpeaker(preferences.speaker)
            if (preferences.speaker && active && mediaActive.current)
              await room.startAudio()
          } catch (error) {
            mediaError = mediaError || error
          }
        changed()
        if (mediaError)
          throw callError(mediaError)
      })
      return () => {
        appState.remove()
        stop()
        events.forEach(event => room.off(event, changed))
        room.off(RoomEvent.ConnectionStateChanged, stateChanged)
      }
    }, [room, roomID, expires, session, chatURL, run, managed])
  )
  const participants = [room.localParticipant, ...room.remoteParticipants.values()]
  const active = callState.active?.room === roomID ? callState.active : undefined
  const conversation =
    active && (active.groupID || active.peer)
      ? conversations.find(item =>
        active.groupID ? item.groupID === active.groupID : item.userID === active.peer
      )
      : undefined
  const disabled = task.busy || room.state !== 'connected'
  const hangUp = () => {
    mediaActive.current = false
    calls.mediaReady(roomID, false)
    stopLocalCapture(room)
    if (managed)
      void calls.finish('end').catch(() => {})
    else
      router.back()
    void room.disconnect().catch(() => {})
  }
  return (
    <ProductModal onRequestClose={hangUp}>
      <CallPresentation
        group={!!active?.groupID}
        name={conversation?.showName || active?.name || active?.peer || '音视频通话'}
        id={active?.groupID || active?.peer || roomID}
        uri={conversation?.faceURL}
        status={
          room.state === 'connected' && connectedAt
            ? `${Math.floor(elapsed / 60)
              .toString()
              .padStart(
                2,
                '0'
              )}:${(elapsed % 60).toString().padStart(2, '0')}${active?.groupID ? ` · ${participants.length} 人` : ''}`
            : status
        }
        error={task.error ? callError({ message: task.error }).message : ''}
        media={
          <View style={{ width: '100%', marginTop: 12 }}>
            {participants.map(participant => (
              <React.Fragment key={participant.identity || 'self'}>
                {[...participant.trackPublications.values()].some(
                  publication => publication.kind === 'video'
                ) && (
                  <Text style={{ color: '#fff', fontSize: 12, marginTop: 4 }}>
                    {participant.name || participant.identity || session.userID}
                    {participant.isLocal ? '（我）' : ''}
                  </Text>
                )}
                {[...participant.trackPublications.values()].map(publication => (
                  <MediaTrack
                    audible={active?.media.speaker !== false}
                    key={publication.trackSid}
                    participant={participant}
                    publication={publication}
                  />
                ))}
              </React.Fragment>
            ))}
          </View>
        }
      >
        <View style={{ flexDirection: 'row', gap: 26, marginBottom: 34 }}>
          <CallControl
            label={room.localParticipant.isMicrophoneEnabled ? '麦克风' : '已静音'}
            icon={room.localParticipant.isMicrophoneEnabled ? 'mic' : 'micOff'}
            active={room.localParticipant.isMicrophoneEnabled}
            disabled={disabled}
            onPress={() => {
              void task.run(async current => {
                try {
                  const enabled = !room.localParticipant.isMicrophoneEnabled
                  await room.localParticipant.setMicrophoneEnabled(enabled)
                  if (current() && mediaActive.current)
                    calls.setMediaPreference(roomID, 'microphone', enabled)
                } catch (error) {
                  throw callError(error)
                }
                if (
                  !current() ||
                  !mediaActive.current ||
                  (managed && calls.snapshot().active?.room !== roomID)
                ) {
                  stopLocalCapture(room)
                  await room.localParticipant.setMicrophoneEnabled(false)
                  return
                }
                setRevision(revision + 1)
              })
            }}
          />
          <CallControl
            label={Platform.OS === 'web' ? '声音' : '扬声器'}
            icon='speaker'
            active={active?.media.speaker !== false}
            disabled={disabled}
            onPress={() => {
              void task.run(async current => {
                const enabled = active?.media.speaker === false
                await setCallSpeaker(enabled)
                if (enabled)
                  await room.startAudio()
                if (current() && mediaActive.current)
                  calls.setMediaPreference(roomID, 'speaker', enabled)
              })
            }}
          />
          <CallControl
            label='摄像头'
            icon='video'
            active={room.localParticipant.isCameraEnabled}
            disabled={disabled}
            onPress={() => {
              void task.run(async current => {
                try {
                  const enabled = !room.localParticipant.isCameraEnabled
                  await room.localParticipant.setCameraEnabled(enabled)
                  if (current() && mediaActive.current)
                    calls.setMediaPreference(roomID, 'camera', enabled)
                } catch (error) {
                  throw callError(error)
                }
                if (
                  !current() ||
                  !mediaActive.current ||
                  (managed && calls.snapshot().active?.room !== roomID)
                ) {
                  stopLocalCapture(room)
                  await room.localParticipant.setCameraEnabled(false)
                  return
                }
                setRevision(revision + 1)
              })
            }}
          />
        </View>
        <CallControl label='挂断' icon='phone' tone='red' onPress={hangUp} />
      </CallPresentation>
    </ProductModal>
  )
}
