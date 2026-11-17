import React, { useSyncExternalStore } from 'react'
import { Text, View } from 'react-native'
import { useProductLayout, useProductScheme } from '../ui/preferences'

let message = ''
let timer: ReturnType<typeof setTimeout> | undefined
const listeners = new Set<() => void>()
const snapshot = () => message
const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
export function showProductToast (text: string) {
  clearTimeout(timer)
  message = text
  listeners.forEach(listener => listener())
  timer = setTimeout(() => {
    message = ''
    listeners.forEach(listener => listener())
  }, 1900)
}
export function ProductToast () {
  const text = useSyncExternalStore(subscribe, snapshot, snapshot)
  const { desktop } = useProductLayout()
  const dark = useProductScheme() === 'dark'
  return text ? (
    <View
      pointerEvents='none'
      style={{
        position: 'absolute',
        bottom: desktop ? 36 : 108,
        left: 0,
        right: 0,
        alignItems: 'center',
      }}
    >
      <Text
        accessibilityLiveRegion='polite'
        style={{
          color: '#fff',
          backgroundColor: dark ? 'rgba(60,60,66,.95)' : 'rgba(20,20,22,.9)',
          borderRadius: 14,
          paddingHorizontal: 16,
          paddingVertical: 10,
          fontSize: 14,
          lineHeight: 20,
          textAlign: 'center',
          overflow: 'hidden',
          maxWidth: '78%',
        }}
      >
        {text}
      </Text>
    </View>
  ) : null
}
