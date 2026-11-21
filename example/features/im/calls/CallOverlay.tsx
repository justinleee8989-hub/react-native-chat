import React, { useEffect, useEffectEvent, useRef, useSyncExternalStore } from 'react'
import { AppState, Platform, View } from 'react-native'
import { useRouter } from 'expo-router'
import { calls, useOpenIM } from '../application/store'
import { useT } from '../i18n'
import { errorMessage } from '../shared/error-message'
import { showProductToast } from '../shared/ProductToast'
import { useTask } from '../shared/useTask'
import { ProductModal } from '../ui/ProductModal'
import { callPage } from './call-page'
import { CallControl, CallPresentation } from './CallPresentation'
import { useRingtone } from './useRingtone'

export default function CallOverlay () {
  const tr = useT()
  const { session, conversations } = useOpenIM()
  const state = useSyncExternalStore(calls.subscribe, calls.snapshot, calls.snapshot)
  const covered = useSyncExternalStore(callPage.subscribe, callPage.covered, callPage.covered)
  const task = useTask()
  const router = useRouter()
  const navigated = useRef('')
  const call = state.active
  const ringing = call?.phase === 'incoming' || call?.phase === 'outgoing'
  useEffect(() => {
    const timer = setInterval(calls.tick, 1000)
    // A call goes on while the app is in the background, ringing or connected.
    const subscription = AppState.addEventListener('change', status => {
      // A call that rang while the app was away may never have reached it as a message.
      if (status === 'active')
        calls.recheck()
    })
    return () => {
      clearInterval(timer)
      subscription.remove()
    }
  }, [])
  // A call answered and ended before it ever connected here passes in a toast, like the one the
  // call page shows when the other side ends it before the media connected.
  const sayEndedBeforeConnect = useEffectEvent(() => showProductToast(tr('call.endedBeforeConnect')))
  useEffect(() => {
    if (state.notice === 'call.endedBeforeConnect')
      sayEndedBeforeConnect()
  }, [state.notice])
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
  // On iOS this modal could not open over the call page, open or closing, and would take every
  // touch unseen: it waits, ringing meanwhile, and shows once the page has closed.
  if (!session || (covered && Platform.OS === 'ios'))
    return null
  const visible = !!call && call.phase !== 'connected'
  // A dropped call is said on its own page, which closes by itself.
  const showNotice = !!state.error
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
      void task.run(calls.finish)
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
