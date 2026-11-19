import React, { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'
import { useT } from '../i18n'
import { chatThemeOf, sentFillStyle, type ChatThemeId } from './chat-theme'
import type { ChatWallpaperId } from './chat-wallpaper'
import { ChatWallpaperOf, useResolvedChatWallpaper } from './ChatWallpaperView'
import { useProductScheme } from './preferences'
import { useProductTheme } from './theme'

/**
 * A few messages in the chosen chat theme over the chosen wallpaper, in the current 深色模式, so
 * the choices can be judged before going back to a real chat. A new wallpaper fades in over the
 * previous one. `children` sit under the messages in the same frame.
 */
export function ChatAppearancePreview ({ wallpaper, theme, height = 170, children }: React.PropsWithChildren<{
  wallpaper: ChatWallpaperId
  theme: ChatThemeId
  height?: number
}>) {
  const tr = useT()
  const t = useProductTheme()
  const preset = chatThemeOf(theme)
  const look = preset[useProductScheme()]
  const hasWallpaper = useResolvedChatWallpaper(wallpaper).kind !== 'plain'
  // Each bubble here ends its group, so it takes the theme's sharper corner.
  const shape = { borderRadius: preset.radius, borderBottomRightRadius: preset.corner }
  // The previous choice stays underneath while the new one fades in over it.
  const [layers, setLayers] = useState({ under: wallpaper, over: wallpaper })
  if (layers.over !== wallpaper)
    setLayers({ under: layers.over, over: wallpaper })
  return (
    <View style={[styles.frame, { borderColor: t.line, backgroundColor: t.bg }]}>
      <View accessible accessibilityLabel={tr('appearance.previewLabel')} style={{ height }}>
        <ChatWallpaperOf id={layers.under} />
        <Animated.View key={layers.over} entering={FadeIn.duration(240)} style={StyleSheet.absoluteFill}>
          <ChatWallpaperOf id={layers.over} />
        </Animated.View>
        <View style={styles.messages}>
          <Text
            style={[
              styles.day,
              { color: hasWallpaper ? t.text2 : t.text3, backgroundColor: hasWallpaper ? t.bar : 'transparent' },
            ]}
          >
            {tr('common.today')}
          </Text>
          <View
            style={[
              styles.bubble,
              styles.incoming,
              { backgroundColor: t.bubble, borderRadius: preset.radius, borderBottomLeftRadius: preset.corner },
            ]}
          >
            <Text style={[styles.text, { color: t.text }]}>{tr('appearance.previewIncoming')}</Text>
            <Text style={[styles.time, { color: t.text3 }]}>09:41</Text>
          </View>
          <View style={[styles.bubble, styles.outgoing, sentFillStyle(look), shape]}>
            <Text style={[styles.text, { color: look.text }]}>{tr('appearance.previewOutgoing')}</Text>
            <Text style={[styles.time, { color: look.meta }]}>09:42 <Text style={{ color: look.ticks ?? look.meta }}>✓✓</Text></Text>
          </View>
        </View>
      </View>
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  frame: { borderRadius: 12, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth },
  messages: { flex: 1, justifyContent: 'center', paddingHorizontal: 12, gap: 6 },
  day: {
    alignSelf: 'center',
    overflow: 'hidden',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 2,
    marginBottom: 4,
    fontSize: 12,
    lineHeight: 16,
  },
  bubble: {
    maxWidth: '78%',
    paddingHorizontal: 14,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'flex-end',
    flexWrap: 'wrap',
    columnGap: 8,
  },
  incoming: { alignSelf: 'flex-start' },
  outgoing: { alignSelf: 'flex-end' },
  text: { fontSize: 15, lineHeight: 21 },
  time: { fontSize: 11, lineHeight: 16 },
})
