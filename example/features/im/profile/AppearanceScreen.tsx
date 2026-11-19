import React from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { type Href } from 'expo-router'
import { useT } from '../i18n'
import { useMasterNavigation } from '../navigation/DesktopNavigation'
import { type ChatThemePreset, chatThemes, sentFillStyle } from '../ui/chat-theme'
import { ChatAppearancePreview } from '../ui/ChatAppearancePreview'
import { ChatWallpaperOf } from '../ui/ChatWallpaperView'
import {
  setChatTheme,
  setProductAppearance,
  useChatTheme,
  useChatWallpaper,
  useProductAppearance,
  useProductLayout,
  useProductScheme,
} from '../ui/preferences'
import { ProductCard, ProductRow, ProductSwitch } from '../ui/primitives'
import { ProductIcon } from '../ui/ProductIcon'
import { ProductPage, ProductSection } from '../ui/ProductPage'
import { ProductPressable as Pressable } from '../ui/ProductPressable'
import { useProductTheme } from '../ui/theme'

const schemes = [{ value: 'light', labelKey: 'appearance.light' }, { value: 'dark', labelKey: 'appearance.dark' }] as const

/** A chat theme as it would look over the current wallpaper: a received and a sent bubble. */
function ThemeCard ({ preset, selected, onPress }: { preset: ChatThemePreset, selected: boolean, onPress: () => void }) {
  const tr = useT()
  const t = useProductTheme()
  const look = preset[useProductScheme()]
  const wallpaper = useChatWallpaper()
  // Scaled down with the bubble, as is the corner a group ends on.
  const round = preset.radius * 0.5
  const end = preset.corner * 0.5
  return (
    <Pressable
      accessibilityRole='radio'
      accessibilityLabel={tr(preset.labelKey)}
      accessibilityState={{ selected, checked: selected }}
      onPress={onPress}
      style={styles.themeOption}
    >
      <View style={[styles.themeRing, { borderColor: selected ? t.accent : 'transparent' }]}>
        <View style={[styles.themeCard, { borderColor: t.line }]}>
          <ChatWallpaperOf id={wallpaper} />
          <View
            style={[
              styles.themeBubble,
              styles.themeOut,
              sentFillStyle(look),
              { borderRadius: round, borderBottomRightRadius: end },
            ]}
          />
          <View
            style={[
              styles.themeBubble,
              styles.themeIn,
              { backgroundColor: t.bubble, borderRadius: round, borderBottomLeftRadius: end },
            ]}
          />
        </View>
      </View>
      <Text style={[styles.themeLabel, { color: selected ? t.accent : t.text2 }]}>{tr(preset.labelKey)}</Text>
    </Pressable>
  )
}

/**
 * 我的 → 外观, grouped like system settings. The first card shows a sample conversation over the
 * wallpaper, the chat themes as cards to swipe through, and the row into 聊天壁纸; the second is
 * 深色模式: it follows the system, and only with 跟随系统 off offers 浅色 and 深色 to pick from. A
 * choice applies at once.
 */
export default function AppearanceScreen () {
  const tr = useT()
  const t = useProductTheme()
  const scheme = useProductScheme()
  const { desktop } = useProductLayout()
  const wallpaper = useChatWallpaper()
  const appearance = useProductAppearance()
  const theme = useChatTheme()
  const openMaster = useMasterNavigation()
  const followSystem = appearance === 'auto'
  return (
    <ProductPage title={tr('me.appearance')} backHref='/(tabs)/me' busy={false} error=''>
      <View style={[styles.content, { paddingHorizontal: desktop ? 24 : 16 }]}>
        <ProductSection variant='list'>{tr('appearance.chatTheme')}</ProductSection>
        <ProductCard>
          <View>
            {/* Framed inside the card: drawn edge to edge, 默认's page color ran into the page around it. */}
            <View style={styles.preview}>
              <ChatAppearancePreview wallpaper={wallpaper} theme={theme} />
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.themes}>
              {chatThemes.map(item => (
                <ThemeCard
                  key={item.id}
                  preset={item}
                  selected={item.id === theme}
                  onPress={() => setChatTheme(item.id)}
                />
              ))}
            </ScrollView>
          </View>
          <ProductRow title={tr('wallpaper.title')} chevron onPress={() => openMaster('/chats/chat-wallpaper' as Href)} />
        </ProductCard>
        <ProductSection variant='list'>{tr('appearance.darkMode')}</ProductSection>
        <ProductCard>
          <ProductRow
            title={tr('appearance.followSystem')}
            trailing={
              <ProductSwitch
                accessibilityLabel={tr('appearance.followSystem')}
                value={followSystem}
                // Turned off, the app keeps the scheme it shows now until another is chosen.
                onValueChange={on => setProductAppearance(on ? 'auto' : scheme)}
              />
            }
          />
          {!followSystem && schemes.map(({ value, labelKey }) => (
            <ProductRow
              key={value}
              title={tr(labelKey)}
              trailing={appearance === value ? <ProductIcon name='check' size={20} color={t.accent} /> : undefined}
              chevron={false}
              onPress={() => setProductAppearance(value)}
            />
          ))}
        </ProductCard>
        <Text style={[styles.hint, { color: t.text3 }]}>
          {followSystem ? tr('appearance.followSystemHint') : tr('appearance.fixedHint')}
        </Text>
      </View>
    </ProductPage>
  )
}

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: 520, alignSelf: 'center', paddingBottom: 24 },
  preview: { paddingHorizontal: 12, paddingTop: 12 },
  themes: { paddingHorizontal: 12, paddingVertical: 12, gap: 10 },
  themeOption: { alignItems: 'center', gap: 6 },
  themeRing: { borderRadius: 14, borderWidth: 2, padding: 2 },
  themeCard: {
    width: 76,
    height: 100,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    paddingHorizontal: 8,
    gap: 8,
  },
  themeBubble: { height: 18 },
  themeOut: { width: '78%', alignSelf: 'flex-end' },
  themeIn: { width: '62%', alignSelf: 'flex-start' },
  themeLabel: { fontSize: 12, lineHeight: 16 },
  hint: { fontSize: 13, lineHeight: 18, paddingHorizontal: 16, paddingTop: 8 },
})
