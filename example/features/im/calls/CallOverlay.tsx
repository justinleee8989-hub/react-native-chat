import React, { useEffect, useRef, useSyncExternalStore } from 'react'
import { AppState, Modal, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useChatListColors } from '@/components/chat-list/theme'
import { calls, useOpenIM } from '../application/store'
import { Action, Label } from '../shared/shared'
import { useTask } from '../shared/useTask'
import { useRingtone } from './useRingtone'

export default function CallOverlay () {
  const { session } = useOpenIM()
  const state = useSyncExternalStore(calls.subscribe, calls.snapshot, calls.snapshot)
  const task = useTask()
  const router = useRouter()
  const colors = useChatListColors()
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
      clearInterval(timer); subscription.remove() 
    }
  }, [])
  const playRingtone = useRingtone(ringing)
  useEffect(() => {
    if (!call) {
      navigated.current = ''
      return
    }
    if (call.phase === 'connected' && navigated.current !== call.room) {
      navigated.current = call.room
      router.push({ pathname: '/chats/call', params: { room: call.room, expires: Date.now() + 15 * 60 * 1000, managed: '1' } })
    }
  }, [call, router])
  if (!session)
    return null
  const visible = !!call && call.phase !== 'connected'
  return <Modal visible={visible || !!state.notice || !!state.error} transparent animationType='fade' onRequestClose={() => {
    if (call)
      void calls.finish(call.phase === 'incoming' ? 'reject' : 'cancel').catch(() => {})
    else
      calls.dismiss()
  }}
  >
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0008', padding: 24 }}>
      <View style={{ width: '100%', maxWidth: 420, borderRadius: 20, padding: 24, gap: 16, backgroundColor: colors.background }}>
        {visible ? <>
          <Label>{call?.phase === 'incoming' ? '音视频来电' : call?.phase === 'accepting' ? '正在接听' : '正在呼叫'}</Label>
          <Label>{call?.name || call?.peer}</Label>
          <Label>45 秒无人接听后自动结束。接听后可开启麦克风和摄像头。</Label>
          <Action title='播放铃声' onPress={playRingtone} />
          {call?.phase === 'incoming' && <Action title='接听' disabled={task.busy} onPress={() => {
            void task.run(calls.accept) 
          }}
          />}
          <Action title={call?.phase === 'incoming' ? '拒接' : '取消呼叫'} danger disabled={task.busy} onPress={() => {
            void task.run(() => calls.finish(call?.phase === 'incoming' ? 'reject' : 'cancel')) 
          }}
          />
        </> : <Label>{state.notice || '通话提示'}</Label>}
        {!!(state.error || task.error) && <Label>{state.error || task.error}</Label>}
        {!visible && <Action title='知道了' onPress={calls.dismiss} />}
      </View>
    </View>
  </Modal>
}
