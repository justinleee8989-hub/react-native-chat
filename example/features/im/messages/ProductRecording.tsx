import React, { useEffect, useRef, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import {
  VoiceMessageInput,
  type VoiceMessageInputProps,
  type VoiceRecordingControlProps,
} from '@kesha-antonov/react-native-chat'
import { reportError } from '../application/store'
import { useProductLayout } from '../ui/preferences'
import { ProductIcon } from '../ui/ProductIcon'
import { useProductTheme } from '../ui/theme'
import { ProductPulse } from './ProductMotion'

type ProductRecordingProps = Pick<VoiceMessageInputProps, 'config' | 'onSend'> & {
  idleVisible: boolean
  onStart: () => void
  onActiveChange: (active: boolean) => void
}

/** Keep the SDK recorder mounted when its tap controls replace the composer. */
export function ProductRecording ({ config, onSend, ...props }: ProductRecordingProps) {
  return (
    <VoiceMessageInput
      config={config}
      onSend={onSend}
      renderControl={controls => <ProductRecordingControl {...props} controls={controls} />}
    />
  )
}

function ProductRecordingControl ({
  controls,
  idleVisible,
  onStart,
  onActiveChange,
}: Omit<ProductRecordingProps, 'config' | 'onSend'> & { controls: VoiceRecordingControlProps }) {
  const t = useProductTheme()
  const { desktop } = useProductLayout()
  const [pending, setPending] = useState(false)
  const [settling, setSettling] = useState(false)
  const stopping = useRef(false)
  const [ended, setEnded] = useState(false)
  const mounted = useRef(false)
  const starting = useRef(false)
  const finished = useRef(false)
  const active = !ended && (pending || controls.isRecording)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  useEffect(() => {
    onActiveChange(active)
  }, [active, onActiveChange])

  const start = () => {
    if (starting.current || stopping.current)
      return
    starting.current = true
    finished.current = false
    setEnded(false)
    setPending(true)
    onStart()
    void controls
      .onStart()
      .catch(reportError)
      .finally(() => {
        starting.current = false
        if (mounted.current)
          setPending(false)
      })
  }
  const finish = (send: boolean) => {
    if (finished.current)
      return
    finished.current = true
    setEnded(true)
    stopping.current = true
    setSettling(true)
    void Promise.resolve()
      .then(() => (pending && !controls.isRecording
        ? controls.onCancel()
        : send ? controls.onSend() : controls.onCancel()))
      .catch(reportError)
      .finally(() => {
        stopping.current = false
        if (mounted.current)
          setSettling(false)
      })
  }
  if (!active)
    return (
      <View
        style={{
          display: idleVisible ? 'flex' : 'none',
          position: 'absolute',
          right: desktop ? 20 : 8,
          bottom: desktop ? 14 : 8,
        }}
      >
        <Pressable
          accessibilityRole='button'
          accessibilityLabel='录制语音消息'
          disabled={pending || settling}
          onPress={start}
          style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}
        >
          <ProductIcon name='mic' size={22} color={t.text2} />
        </Pressable>
      </View>
    )

  const requestingMicrophone = pending && !controls.isRecording
  const seconds = Math.floor(controls.elapsed / 1000)
  const timer = `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 10,
        paddingHorizontal: desktop ? 20 : 12,
        width: '100%',
        maxWidth: 920,
        alignSelf: 'center',
      }}
    >
      <ProductPulse size={10} color={t.danger} />
      <Text
        accessibilityLabel={requestingMicrophone ? '录音状态' : '录音时长'}
        style={{ flex: 1, fontSize: 16, color: t.text, fontVariant: ['tabular-nums'] }}
      >
        {requestingMicrophone ? '正在请求麦克风…' : timer}
      </Text>
      <Pressable
        accessibilityRole='button'
        accessibilityLabel='取消录音'
        onPress={() => finish(false)}
        style={{ padding: 8 }}
      >
        <Text style={{ color: t.accent, fontSize: 16 }}>取消</Text>
      </Pressable>
      <Pressable
        accessibilityRole='button'
        accessibilityLabel='发送语音'
        onPress={() => finish(true)}
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: t.accent,
        }}
      >
        <ProductIcon name='send' size={22} color={t.onAccent} />
      </Pressable>
    </View>
  )
}
