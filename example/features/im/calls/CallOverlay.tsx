import React, { useEffect, useRef, useSyncExternalStore } from 'react'
import { AppState, Platform, View } from 'react-native'
import { useRouter } from 'expo-router'
import { calls, useOpenIM } from '../application/store'
import { useTask } from '../shared/useTask'
import { ProductModal } from '../ui/ProductModal'
import { CallControl, CallPresentation } from './CallPresentation'
import { useRingtone } from './useRingtone'

export default function CallOverlay () {
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
  const showNotice = !!state.error || state.notice === '连接中断，通话已结束'
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
          visible ? conversation?.showName || call?.name || call?.peer || '音视频通话' : '通话提示'
        }
        id={call?.groupID || call?.peer || ''}
        uri={conversation?.faceURL}
        status={
          visible
            ? call?.phase === 'incoming'
              ? '邀请你进行音视频通话'
              : call?.phase === 'accepting'
                ? '正在接听…'
                : '正在呼叫…'
            : state.notice
        }
        error={state.error || task.error}
      >
        {visible ? (
          call?.phase === 'incoming' ? (
            <View style={{ flexDirection: 'row', gap: 72 }}>
              <CallControl
                label='拒接'
                icon='phone'
                tone='red'
                disabled={task.busy}
                onPress={finish}
              />
              <CallControl
                label='接听'
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
                  label={call?.media.microphone ? '麦克风' : '已静音'}
                  icon={call?.media.microphone ? 'mic' : 'micOff'}
                  active={call?.media.microphone}
                  disabled={task.busy}
                  onPress={() => {
                    if (call)
                      calls.setMediaPreference(call.room, 'microphone', !call.media.microphone)
                  }}
                />
                <CallControl
                  label={Platform.OS === 'web' ? '声音' : '扬声器'}
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
                  label='摄像头'
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
                label='取消'
                icon='phone'
                tone='red'
                disabled={task.busy}
                onPress={finish}
              />
            </>
          )
        ) : (
          <CallControl label='知道了' icon='check' onPress={calls.dismiss} />
        )}
      </CallPresentation>
    </ProductModal>
  )
}
