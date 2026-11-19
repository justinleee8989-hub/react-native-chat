import React from 'react'
import { Text } from 'react-native'
import type { ConnectionStatus as Status } from '../application/connection-status'
import { useT } from '../i18n'
import { useProductTheme } from '../ui/theme'

export function ConnectionStatus ({ status }: { status?: Status }) {
  const t = useProductTheme()
  const tr = useT()
  if (!status || status === 'connected')
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
      {tr(`status.${status}`)}
    </Text>
  )
}
