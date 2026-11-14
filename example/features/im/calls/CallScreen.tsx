import React, { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { AppState } from 'react-native'
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import { Room, RoomEvent } from 'livekit-client'
import { calls, useOpenIM } from '../application/store'
import LoginScreen from '../auth/LoginScreen'
import { Action, Label, Page } from '../shared/shared'
import { useTask } from '../shared/useTask'
import { callError } from './errors'
import { assertActiveInvitation } from './invitation'
import { MediaTrack, prepareAudio, releaseAudio } from './platform'
import { requestCallToken } from './token-api'

export default function CallScreen () {
  const { room: roomID, expires, managed } = useLocalSearchParams<{ room: string, expires: string, managed?: string }>()
  const { session, config } = useOpenIM()
  return session ? <Call key={`${session.userID}:${roomID}`} roomID={roomID} managed={managed === '1'} expires={Number(expires)} session={session} chatURL={config.chat} /> : <LoginScreen />
}
function Call ({ roomID, expires, session, chatURL, managed }: { managed: boolean, roomID: string, expires: number, session: NonNullable<ReturnType<typeof useOpenIM>['session']>, chatURL: string }) {
  const router = useRouter()
  const callState = useSyncExternalStore(calls.subscribe, calls.snapshot, calls.snapshot)
  const task = useTask()
  const { run } = task
  const [room] = useState(() => new Room({ adaptiveStream: true, dynacast: true }))
  const [revision, setRevision] = useState(0)
  const [status, setStatus] = useState('准备连接')
  const mediaActive = useRef(false)
  useEffect(() => {
    if (managed && callState.active?.room !== roomID) {
      void room.disconnect().catch(() => {})
      router.back()
    }
  }, [managed, callState.active?.room, roomID, room, router])
  useFocusEffect(useCallback(() => {
    if (managed && calls.snapshot().active?.room !== roomID)
      return
    let active = true
    mediaActive.current = true
    const stop = () => {
      active = false
      calls.mediaReady(roomID, false)
      mediaActive.current = false
      void room.disconnect().finally(releaseAudio).catch(() => {})
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
        setStatus(room.state === 'connected' ? '已连接' : room.state === 'reconnecting' ? '正在重连' : '连接已断开') 
    }
    const events = [RoomEvent.ParticipantConnected, RoomEvent.ParticipantDisconnected, RoomEvent.TrackSubscribed, RoomEvent.TrackUnsubscribed, RoomEvent.LocalTrackPublished, RoomEvent.LocalTrackUnpublished, RoomEvent.TrackMuted, RoomEvent.TrackUnmuted]
    events.forEach(event => room.on(event, changed))
    room.on(RoomEvent.ConnectionStateChanged, stateChanged)
    void run(async current => {
      assertActiveInvitation({ room: roomID, expires })
      const credentials = await requestCallToken(session, roomID, chatURL)
      if (!current() || !active) 
        return
      await prepareAudio()
      if (!active) {
        await releaseAudio(); return
      }
      await room.connect(credentials.serverUrl, credentials.token)
      if (!current() || !active) {
        await room.disconnect(); return 
      }
      changed()
    })
    return () => {
      appState.remove()
      stop()
      events.forEach(event => room.off(event, changed))
      room.off(RoomEvent.ConnectionStateChanged, stateChanged)
    }
  }, [room, roomID, expires, session, chatURL, run, managed]))
  const participants = [room.localParticipant, ...room.remoteParticipants.values()]
  return <Page title='音视频通话' {...task} error={task.error ? callError({ message: task.error }).message : ''}>
    <Label>{status} · {participants.length} 人</Label>
    <Label>加入时麦克风和摄像头默认关闭，请按需开启。邀请有效期内，收到邀请的人可加入。</Label>
    <Action title={room.localParticipant.isMicrophoneEnabled ? '关闭麦克风' : '开启麦克风'} disabled={task.busy || room.state !== 'connected'} onPress={() => {
      void task.run(async current => {
        try {
          await room.localParticipant.setMicrophoneEnabled(!room.localParticipant.isMicrophoneEnabled)
        } catch (error) {
          throw callError(error)
        }
        if (!current() || !mediaActive.current) {
          await room.localParticipant.setMicrophoneEnabled(false)
          return
        }
        setRevision(revision + 1)
      }) 
    }}
    />
    <Action title={room.localParticipant.isCameraEnabled ? '关闭摄像头' : '开启摄像头'} disabled={task.busy || room.state !== 'connected'} onPress={() => {
      void task.run(async current => {
        try {
          await room.localParticipant.setCameraEnabled(!room.localParticipant.isCameraEnabled)
        } catch (error) {
          throw callError(error)
        }
        if (!current() || !mediaActive.current) {
          await room.localParticipant.setCameraEnabled(false)
          return
        }
        setRevision(revision + 1)
      }) 
    }}
    />
    <Action title='播放通话声音' disabled={task.busy} onPress={() => {
      void task.run(async () => {
        await room.startAudio() 
      }) 
    }}
    />
    {participants.map(participant => <React.Fragment key={participant.identity || 'self'}>
      <Label>{participant.name || participant.identity || session.userID}{participant.isLocal ? '（我）' : ''}</Label>
      {[...participant.trackPublications.values()].map(publication => <MediaTrack key={publication.trackSid} participant={participant} publication={publication} />)}
    </React.Fragment>)}
    <Action title='挂断并返回' danger onPress={() => {
      void room.disconnect().finally(() => router.back()) 
    }}
    />
  </Page>
}
