import React, { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Platform, Text, View } from 'react-native'
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import { Room, RoomEvent, type Participant } from 'livekit-client'
import { calls, useOpenIM } from '../application/store'
import LoginScreen from '../auth/LoginScreen'
import type { MessageKey } from '../i18n'
import { useT } from '../i18n'
import { errorMessage } from '../shared/error-message'
import { ProductToast, showProductToast } from '../shared/ProductToast'
import { useTask } from '../shared/useTask'
import { ProductModal } from '../ui/ProductModal'
import { callPage } from './call-page'
import { CallControl, CallPresentation, callConnectionLabel } from './CallPresentation'
import { callConnectError, callError, callJoinError } from './errors'
import { assertActiveInvitation } from './invitation'
import { applyInitialMedia, stopLocalCapture } from './media-setup'
import { MediaTrack, prepareAudio, releaseAudio, setCallSpeaker } from './platform'
import { requestCallToken } from './token-api'
import { useCallKeepAlive } from './useCallKeepAlive'

/** How long a dropped call's page says so before it closes. */
const DROPPED_NOTICE_MS = 2000

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
  const tr = useT()
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
  const [status, setStatus] = useState<MessageKey>('call.preparing')
  // Whether the other side of a one-to-one call has been in the room: gone from it since, they
  // have lost their connection, and the server ends the call only once they have had time to come back.
  const [peerSeen, setPeerSeen] = useState(false)
  const mediaActive = useRef(false)
  // Whether the media set out with has been applied here, its permissions asked for and answered.
  const [mediaSet, setMediaSet] = useState(false)
  const translate = useRef(tr)
  // A call page opened on its own (a link, or a reloaded web page) has nothing to go back to.
  const leave = useCallback(() => {
    if (router.canGoBack())
      router.back()
    else
      router.replace('/(tabs)/chats')
  }, [router])
  useLayoutEffect(() => {
    translate.current = tr
  }, [tr])
  // Whether the media ever connected here, and whether this side ended the call. This page opens
  // once the call is answered, so a call the other side ends before the media connected here (its
  // own connection failed) is said as such, rather than the page just closing.
  const joined = useRef(false)
  const endedHere = useRef(false)
  // A dropped call is said here, then the page closes by itself. A notice of its own could not
  // open over this page while it closes: on iOS it would stay, unseen, and take every touch.
  const [dropped, setDropped] = useState(false)
  useEffect(() => callPage.open(), [])
  useEffect(() => {
    if (!managed || callState.active?.room === roomID)
      return
    void room.disconnect().catch(() => {})
    if (!joined.current && !endedHere.current) {
      showProductToast(translate.current('call.endedBeforeConnect'))
    } else if (!endedHere.current && calls.snapshot().notice === 'call.droppedEnded') {
      setDropped(true)
      const timer = setTimeout(() => router.back(), DROPPED_NOTICE_MS)
      return () => clearTimeout(timer)
    }
    router.back()
  }, [managed, callState.active?.room, roomID, room, router])
  useFocusEffect(
    useCallback(() => {
      if (managed && calls.snapshot().active?.room !== roomID)
        return
      let active = true
      mediaActive.current = true
      const stop = () => {
        active = false
        endedHere.current = true
        calls.mediaReady(roomID, false)
        mediaActive.current = false
        setMediaSet(false)
        stopLocalCapture(room)
        void room
          .disconnect()
          .finally(releaseAudio)
          .catch(() => {})
        if (managed && calls.snapshot().active?.room === roomID)
          void calls.finish().catch(() => {})
      }
      // The call goes on with the app in the background: its audio keeps the app running there.
      const changed = () => {
        if (active)
          setRevision(value => value + 1)
        if (active && room.remoteParticipants.size) {
          setPeerSeen(true)
          calls.peerJoined(roomID)
        }
      }
      const stateChanged = () => {
        if (room.state === 'connected')
          joined.current = true
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
        // Never joined, and cannot: end the call at once, so the other side is not left counting a
        // call nobody joined until the server's lease runs out, and go back to the chat. Said once,
        // in the toast: the page is closing, so it is not also left on it.
        const giveUp = (said: string) => {
          if (!current() || !active)
            return false
          stop()
          showProductToast(said)
          if (!managed)
            leave()
          return true
        }
        let credentials: Awaited<ReturnType<typeof requestCallToken>>
        try {
          assertActiveInvitation({ room: roomID, expires })
          credentials = await requestCallToken(session, roomID, chatURL)
        } catch (error) {
          // An expired invitation, or one the server will not let this user join.
          if (giveUp(errorMessage(callJoinError(error), translate.current)))
            return
          throw error
        }
        if (!current() || !active)
          return
        await prepareAudio()
        if (!active) {
          await releaseAudio()
          return
        }
        try {
          await room.connect(credentials.serverUrl, credentials.token)
        } catch (error) {
          const failure = callConnectError(error)
          if (giveUp(translate.current(failure.key)))
            return
          throw failure
        }
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
        if (active)
          setMediaSet(true)
        changed()
        if (mediaError)
          throw callError(mediaError)
      })
      return () => {
        stop()
        events.forEach(event => room.off(event, changed))
        room.off(RoomEvent.ConnectionStateChanged, stateChanged)
      }
    }, [room, roomID, expires, session, chatURL, run, managed, leave])
  )
  const participants = [room.localParticipant, ...room.remoteParticipants.values()]
  const active = callState.active?.room === roomID ? callState.active : undefined
  // The call this page shows, kept while it says the call dropped: the store has let it go by then.
  const [lastActive, setLastActive] = useState(active)
  if (active && active !== lastActive)
    setLastActive(active)
  const shown = active || (dropped ? lastActive : undefined)
  const conversation =
    shown && (shown.groupID || shown.peer)
      ? conversations.find(item =>
        shown.groupID ? item.groupID === shown.groupID : item.userID === shown.peer
      )
      : undefined
  const name = conversation?.showName || shown?.name || shown?.peer || tr(shown?.groupID ? 'call.group' : 'call.title')
  useCallKeepAlive(
    mediaSet && room.state !== 'disconnected' && (!managed || active)
      ? {
        title: name,
        microphone: room.localParticipant.isMicrophoneEnabled,
        camera: room.localParticipant.isCameraEnabled,
      }
      : undefined
  )
  const disabled = task.busy || room.state !== 'connected'
  // A camera turned off stays published, muted, and would show its last frame. One not yet
  // subscribed has no stream: a video view mounted without one stays black on Android once it comes.
  const shownTracks = (participant: Participant) =>
    [...participant.trackPublications.values()].filter(
      publication => publication.kind !== 'video' || (!publication.isMuted && !!publication.track)
    )
  const camera = (participant: Participant) => {
    const publication = shownTracks(participant).find(item => item.kind === 'video')
    return publication && { participant, publication }
  }
  // With one other person, their camera fills the page and yours sits in a corner; without
  // theirs, yours fills it. A group shows every camera in a list.
  const oneOnOne = !active?.groupID && participants.length <= 2
  const own = camera(room.localParticipant)
  const theirs = oneOnOne ? [...room.remoteParticipants.values()].map(camera).find(Boolean) : undefined
  const stage = oneOnOne ? theirs || own : undefined
  const inset = theirs && own
  const placed = new Set([stage?.publication, inset?.publication])
  const peerAway = !!active && !active.groupID && peerSeen && room.state === 'connected' && room.remoteParticipants.size === 0
  const hangUp = () => {
    endedHere.current = true
    mediaActive.current = false
    calls.mediaReady(roomID, false)
    stopLocalCapture(room)
    if (managed)
      void calls.finish().catch(() => {})
    else
      leave()
    void room.disconnect().catch(() => {})
  }
  return (
    <ProductModal onRequestClose={dropped ? () => router.back() : hangUp}>
      <CallPresentation
        group={!!shown?.groupID}
        name={name}
        id={shown?.groupID || shown?.peer || roomID}
        uri={conversation?.faceURL}
        status={
          dropped
            ? tr('call.droppedEnded')
            : peerAway
              ? tr('call.peerAway')
              : room.state === 'connected' && connectedAt
                ? `${Math.floor(elapsed / 60)
                  .toString()
                  .padStart(
                    2,
                    '0'
                  )}:${(elapsed % 60).toString().padStart(2, '0')}${active?.groupID ? ` · ${tr('chatInfo.memberCount', { count: participants.length })}` : ''}`
                : tr(status)
        }
        error={task.error}
        stage={stage && (
          <MediaTrack
            audible={active?.media.speaker !== false}
            key={stage.publication.trackSid}
            layout='stage'
            participant={stage.participant}
            publication={stage.publication}
          />
        )}
        inset={inset && (
          <MediaTrack
            audible={active?.media.speaker !== false}
            key={inset.publication.trackSid}
            layout='inset'
            participant={inset.participant}
            publication={inset.publication}
          />
        )}
        media={
          <View style={{ width: '100%', marginTop: 12 }}>
            {participants.map(participant => {
              const publications = shownTracks(participant).filter(publication => !placed.has(publication))
              return (
                <React.Fragment key={participant.identity || 'self'}>
                  {publications.some(publication => publication.kind === 'video') && (
                    <Text style={{ color: '#fff', fontSize: 12, marginTop: 4 }}>
                      {participant.name || participant.identity || session.userID}
                      {participant.isLocal ? tr('call.me') : ''}
                    </Text>
                  )}
                  {publications.map(publication => (
                    <MediaTrack
                      audible={active?.media.speaker !== false}
                      key={publication.trackSid}
                      participant={participant}
                      publication={publication}
                    />
                  ))}
                </React.Fragment>
              )
            })}
          </View>
        }
      >
        <View style={{ flexDirection: 'row', gap: 26, marginBottom: 34 }}>
          <CallControl
            label={room.localParticipant.isMicrophoneEnabled ? tr('call.microphone') : tr('call.muted')}
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
            label={Platform.OS === 'web' ? tr('call.sound') : tr('call.speaker')}
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
            label={tr('call.camera')}
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
        <CallControl label={tr('call.hangUp')} icon='phone' tone='red' disabled={dropped} onPress={hangUp} />
      </CallPresentation>
      {/* A failed call says why at once, here: this modal covers every other page's toast, and it
          can stay up for seconds after the failure, until the server ends the call. The pages
          under it hide theirs meanwhile, and show what is left of it once the modal closes. */}
      <ProductToast modal />
    </ProductModal>
  )
}
