import React from 'react'
import { Text } from 'react-native'
import { useProductTheme } from '../ui/theme'

export function ConnectionStatus ({ status }: { status?: string }) {
  const t = useProductTheme()
  if (!status || status === '已连接')
    return null
  return (
    <Text
      accessibilityRole='alert'
      accessibilityLiveRegion='polite'
      style={{
        color: t.text2,
        backgroundColor: t.surface2,
        paddingHorizontal: 16,
        paddingVertical: 8,
        fontSize: 13,
      }}
    >
      {status}
    </Text>
  )
}
