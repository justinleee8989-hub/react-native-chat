import React from 'react'
import { Text, View } from 'react-native'
import { GestureDetector, useTapGesture } from 'react-native-gesture-handler'
import type { IMMessage } from '../domain/types'
import { ProductIcon } from '../ui/ProductIcon'
import { useProductTheme } from '../ui/theme'
import { callMessageLabel, messageCallSignal } from './message-projection'
import { formatCallDuration } from './terminal-metadata'

export function CallMessageAction ({
  label,
  disabled,
  onPress,
  children,
}: React.PropsWithChildren<{ label: string, disabled?: boolean, onPress: () => void }>) {
  const activate = () => {
    if (!disabled)
      onPress()
  }
  const gesture = useTapGesture({
    runOnJS: true,
    cancelsTouchesInView: false,
    onDeactivate: event => {
      if (!event.canceled)
        activate()
    },
  })
  return (
    <GestureDetector gesture={gesture}>
      <View
        accessible
        accessibilityRole='button'
        accessibilityLabel={label}
        accessibilityState={{ disabled }}
        onAccessibilityTap={activate}
      >
        {children}
      </View>
    </GestureDetector>
  )
}
export function CallMessage ({
  message,
  self,
  onCall,
}: {
  message?: IMMessage
  self: string
  onCall: () => void
}) {
  const t = useProductTheme()
  if (!message || !messageCallSignal(message))
    return null
  const signal = messageCallSignal(message)
  const duration = signal?.connectedAt ? formatCallDuration(signal.durationSeconds) : ''
  const label = [callMessageLabel(message, self), duration].filter(Boolean).join(' ')
  const color = message.sendID === self ? t.onAccent : t.text
  return (
    <CallMessageAction label={`${label}，再次呼叫`} onPress={onCall}>
      <View
        style={{
          paddingVertical: 12,
          paddingHorizontal: 14,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <ProductIcon name='phone' size={20} color={color} />
        <Text style={{ color, fontSize: 16, lineHeight: 22 }}>{label}</Text>
      </View>
    </CallMessageAction>
  )
}
