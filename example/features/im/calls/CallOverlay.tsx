import React, { useEffect, useRef, useSyncExternalStore } from 'react'
import { AppState, Platform, View } from 'react-native'
import { useRouter } from 'expo-router'
import { calls, useOpenIM } from '../application/store'
import { useT } from '../i18n'
import { errorMessage } from '../shared/error-message'
import { useTask } from '../shared/useTask'
import { ProductModal } from '../ui/ProductModal'
import { CallControl, CallPresentation } from './CallPresentation'
import { useRingtone } from './useRingtone'

export default function CallOverlay () {
  const tr = useT()
  const { session, conversations } = useOpenIM()
  const state = useSyncExternalStore(calls.subscribe, calls.snapshot, calls.snapshot)
  const task = useTask()
  const router = useRouter()
  const navigated = useRef('')
  const call = state.active
  const ringing = call?.phase === 'incoming' || call?.phase === 'outgoing'
  useEffect(() => {
    const timer = setInterval(calls.tick, 1000)
    const subscription = AppState.addEventListener('change', status => {
      if (status === 'background')
        void calls.finish('end').catch(() => {})
    })
    return () => {
      clearInterval(timer)
      subscription.remove()
    }
  }, [])
  const playRingtone = useRingtone(ringing && call?.media.speaker !== false)
  useEffect(() => {
    if (!call) {
      navigated.current = ''
      return
    }
    if (call.phase === 'connected' && navigated.current !== call.room) {
      navigated.current = call.room
      router.push({
        pathname: '/chats/call',
        params: { room: call.room, expires: Date.now() + 15 * 60 * 1000, managed: '1' },
      })
    }
  }, [call, router])
  if (!session)
    return null
  const visible = !!call && call.phase !== 'connected'
  const showNotice = !!state.error || state.notice === 'call.droppedEnded'
  if (!visible && !showNotice)
    return null
  const conversation =
    call && (call.groupID || call.peer)
      ? conversations.find(item =>
        call.groupID ? item.groupID === call.groupID : item.userID === call.peer
      )
      : undefined
  const finish = () => {
    if (!task.busy)
      void task.run(() => calls.finish(call?.phase === 'incoming' ? 'reject' : 'cancel'))
  }
  return (
    <ProductModal
      visible
      transparent
      animationType='fade'
      onRequestClose={() => {
        if (call)
          finish()
        else
          calls.dismiss()
      }}
    >
      <CallPresentation
        group={!!call?.groupID}
        name={
          visible ? conversation?.showName || call?.name || call?.peer || tr(call?.groupID ? 'call.group' : 'call.title') : tr('call.noticeTitle')
        }
        id={call?.groupID || call?.peer || ''}
        uri={conversation?.faceURL}
        status={
          visible
            ? call?.phase === 'incoming'
              ? tr('call.inviting')
              : call?.phase === 'accepting'
                ? tr('call.answering')
                : tr('call.ringing')
            : state.notice ? tr(state.notice) : ''
        }
        error={errorMessage(state.error, tr) || task.error}
      >
        {visible ? (
          call?.phase === 'incoming' ? (
            <View style={{ flexDirection: 'row', gap: 72 }}>
              <CallControl
                label={tr('call.decline')}
                icon='phone'
                tone='red'
                disabled={task.busy}
                onPress={finish}
              />
              <CallControl
                label={tr('call.accept')}
                icon='phone'
                tone='green'
                disabled={task.busy}
                onPress={() => {
                  void task.run(calls.accept)
                }}
              />
            </View>
          ) : (
            <>
              <View style={{ flexDirection: 'row', gap: 26, marginBottom: 34 }}>
                <CallControl
                  label={call?.media.microphone ? tr('call.microphone') : tr('call.muted')}
                  icon={call?.media.microphone ? 'mic' : 'micOff'}
                  active={call?.media.microphone}
                  disabled={task.busy}
                  onPress={() => {
                    if (call)
                      calls.setMediaPreference(call.room, 'microphone', !call.media.microphone)
                  }}
                />
                <CallControl
                  label={Platform.OS === 'web' ? tr('call.sound') : tr('call.speaker')}
                  icon='speaker'
                  active={call?.media.speaker}
                  onPress={() => {
                    if (call) {
                      calls.setMediaPreference(call.room, 'speaker', !call.media.speaker)
                      if (!call.media.speaker)
                        playRingtone()
                    }
                  }}
                />
                <CallControl
                  label={tr('call.camera')}
                  icon='video'
                  active={call?.media.camera}
                  disabled={task.busy}
                  onPress={() => {
                    if (call)
                      calls.setMediaPreference(call.room, 'camera', !call.media.camera)
                  }}
                />
              </View>
              <CallControl
                label={tr('common.cancel')}
                icon='phone'
                tone='red'
                disabled={task.busy}
                onPress={finish}
              />
            </>
          )
        ) : (
          <CallControl label={tr('call.gotIt')} icon='check' onPress={calls.dismiss} />
        )}
      </CallPresentation>
    </ProductModal>
  )
}
