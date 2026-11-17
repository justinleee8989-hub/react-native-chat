import React from 'react'
import { Pressable, ScrollView, Text } from 'react-native'
import { useProductLayout } from '../../ui/preferences'
import { useProductTheme } from '../../ui/theme'
import { emojis } from './constants'
import { styles } from './styles'
import type { EmojiPanelProps } from './types'

export function EmojiPanel ({ panelWidth, setPanelWidth, text, onChangeText }: EmojiPanelProps) {
  const t = useProductTheme()
  const { desktop } = useProductLayout()
  const emojiColumns = desktop ? Math.max(1, Math.floor((panelWidth - 48 + 2) / 46)) : 8
  const emojiWidth = (panelWidth - (desktop ? 48 : 20) - (emojiColumns - 1) * 2) / emojiColumns
  return (
    <ScrollView
      onLayout={event => setPanelWidth(Math.min(920, event.nativeEvent.layout.width))}
      keyboardShouldPersistTaps='handled'
      style={[styles.emojiPanel, { borderColor: t.line }]}
      contentContainerStyle={[styles.emojiContent, {
        paddingTop: desktop ? 12 : 10,
        paddingHorizontal: desktop ? 24 : 10,
        paddingBottom: desktop ? 18 : 16,
      }]}
    >
      {emojis.map(emoji => (
        <Pressable
          key={emoji}
          accessibilityRole='button'
          accessibilityLabel={emoji}
          onPress={() => onChangeText?.(`${text || ''}${emoji}`)}
          style={[styles.emojiButton, { width: emojiWidth }]}
        >
          <Text style={styles.emojiText}>{emoji}</Text>
        </Pressable>
      ))}
    </ScrollView>
  )
}
