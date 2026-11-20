import React, { useLayoutEffect, useSyncExternalStore } from 'react'
import { Text, View } from 'react-native'
import { useProductLayout, useProductScheme } from '../ui/preferences'

let message = ''
let timer: ReturnType<typeof setTimeout> | undefined
// Hosts inside a modal (the call page) that are mounted now. While one is, it alone shows the
// toast: the pages under the modal still host theirs, and a screen reader would hear it twice.
let modalHosts = 0
const listeners = new Set<() => void>()
const snapshot = () => message
const covered = () => modalHosts > 0
const notify = () => listeners.forEach(listener => listener())
const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
export function showProductToast (text: string) {
  clearTimeout(timer)
  message = text
  notify()
  timer = setTimeout(() => {
    message = ''
    notify()
  }, 1900)
}
/** `modal`: this host is in a modal over every page, and shows the toast in their place. */
export function ProductToast ({ modal = false }: { modal?: boolean }) {
  const text = useSyncExternalStore(subscribe, snapshot, snapshot)
  const hidden = useSyncExternalStore(subscribe, covered, covered) && !modal
  useLayoutEffect(() => {
    if (!modal)
      return
    modalHosts++
    notify()
    return () => {
      modalHosts--
      notify()
    }
  }, [modal])
  const { desktop } = useProductLayout()
  const dark = useProductScheme() === 'dark'
  return text && !hidden ? (
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
