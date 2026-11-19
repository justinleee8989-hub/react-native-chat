import React, { useMemo } from 'react'
import { defaultLightTheme, mergeTheme, type ChatIcons } from '@kesha-antonov/react-native-chat'
import { chatThemeOf } from './chat-theme'
import { resolveChatWallpaper } from './chat-wallpaper'
import { useChatTheme, useChatWallpaper, useChatWallpaperPhoto, useProductLayout, useProductScheme } from './preferences'
import { ProductIcon } from './ProductIcon'
import { useProductTheme } from './theme'

/** The doodle tile drawn over every chat wallpaper preset (black, tinted by the wallpaper). */
export const chatPattern = require('../../../assets/images/chat-pattern.png')

/** The current chat theme's preset and its look in the current scheme, for sent-message parts. */
export function useChatThemeLook () {
  const preset = chatThemeOf(useChatTheme())
  return { preset, look: preset[useProductScheme()] }
}

/**
 * The text and icon color for parts inside a sent bubble (text, links, quotes, files, voice,
 * location): the chat theme's, since not every theme's sent bubbles are dark (经典's are light).
 */
export function useSentPartColor () {
  return useChatThemeLook().look.text
}

/**
 * The pill behind the chat's date and system notices over a wallpaper, so they stay readable on a
 * photo or a strong color; undefined over the plain page, where they need none.
 */
export function useChatPill () {
  const t = useProductTheme()
  const wallpaper = resolveChatWallpaper(useChatWallpaper(), useProductScheme(), useChatWallpaperPhoto())
  return wallpaper.kind === 'plain' ? undefined : { backgroundColor: t.bar, color: t.text2 }
}

// Memoized: the chat resolves its theme by identity, and a new theme object re-renders every
// bubble on screen, so each render of the chat page must hand it the same one.
export function useProductChatTheme () {
  const t = useProductTheme()
  const { desktop } = useProductLayout()
  const scheme = useProductScheme()
  const wallpaper = resolveChatWallpaper(useChatWallpaper(), scheme, useChatWallpaperPhoto())
  const gradient = wallpaper.kind === 'gradient' ? wallpaper.colors : undefined
  const solid = wallpaper.kind === 'color' ? wallpaper.color : undefined
  // Anything but the plain page shows through the composer band and puts the date on a pill.
  const hasWallpaper = wallpaper.kind !== 'plain'
  // 我的 → 外观 → 聊天主题: the sent bubbles' fill, colors and shape, and the chat's accent.
  const theme = chatThemeOf(useChatTheme())
  const look = theme[scheme]
  return useMemo(() => mergeTheme(defaultLightTheme, {
    avatar: { size: 30 },
    composer: { minHeight: 40, maxHeight: 118, fieldPaddingH: 14, insetButtonWidth: 36 },
    sendButton: { size: 40 },
    voice: {
      idleBackground: 'transparent',
      idleIcon: t.text2,
    },
    // 我的 → 外观 → 聊天壁纸: a swirl gradient is the library's own wallpaper; a solid color is the
    // chat background; a photo is drawn by the chat page (`renderWallpaper`).
    wallpaper: gradient
      ? { isEnabled: true, colors: gradient, isAnimated: true, pattern: chatPattern }
      : { isEnabled: false },
    bubble: {
      // The product bubble draws its own corners (`ProductBubble`), from the theme's shape.
      hasTail: false,
      isTimeInline: false,
      outgoingGradient: look.gradient,
      outgoingGradientMode: 'window',
    },
    radii: { bubble: theme.radius, bubbleGrouped: 6, inputField: 20, sendButton: 20 },
    spacing: {
      bubblePaddingH: 14,
      bubblePaddingV: 9,
      bubblePaddingBottom: 9,
      betweenGroups: 10,
      screenEdge: desktop ? 28 : 12,
      inputToolbarPaddingV: 8,
    },
    typography: {
      composer: { fontSize: 16, lineHeight: 22 },
      message: { fontSize: 16, lineHeight: 22 },
      day: { fontSize: 12 },
    },
    colors: {
      background: solid ?? t.bg,
      accent: look.accent,
      incomingBubble: t.bubble,
      outgoingBubble: look.bubble,
      incomingText: t.text,
      outgoingText: look.text,
      outgoingLink: look.link ?? look.text,
      incomingMeta: t.text3,
      outgoingMeta: look.meta,
      incomingBubbleShadow: 'transparent',
      outgoingBubbleShadow: 'transparent',
      inputBackground: t.surface,
      // Over a wallpaper the band behind the composer lets it show through.
      inputBarBackground: hasWallpaper ? 'transparent' : t.bg,
      inputText: t.text,
      placeholder: t.text3,
      inputFieldBorder: t.line,
      composerIcon: t.text2,
      dayPillBackground: hasWallpaper ? t.bar : 'transparent',
      dayPillText: hasWallpaper ? t.text2 : t.text3,
      surface: t.surface,
      error: t.danger,
      ticksRead: look.ticks ?? look.meta,
      ticksSent: look.meta,
    },
    chatList: {
      background: t.page,
      headerBackground: t.page,
      headerText: t.text,
      name: t.text,
      message: t.text2,
      date: t.text3,
      badge: t.accent,
      badgeMuted: t.text3,
      badgeText: t.onAccent,
      divider: t.line,
      pressed: t.surface2,
      selectedRow: t.accentWeak,
      archiveAvatar: t.surface2,
    },
    contextMenu: {
      background: t.surface,
      text: t.text,
      icon: t.text2,
      separator: t.line,
      pressed: t.surface2,
      destructive: t.danger,
      scrim: t.scrim,
    },
    attachments: {
      background: t.surface,
      text: t.text,
      secondaryText: t.text2,
      tabBackground: t.surface2,
      tabText: t.text,
      tabSelected: t.accent,
      sendButton: t.accent,
    },
    emojiKeyboard: {
      background: t.page,
      searchBackground: t.surface2,
      searchText: t.text,
      sectionTitle: t.text2,
      icon: t.text2,
      iconSelected: t.accent,
    },
  }), [t, desktop, gradient, solid, hasWallpaper, theme, look])
}
export const productChatIcons: ChatIcons = {
  paperclip: props => <ProductIcon {...props} name='plus' />,
  emoji: props => <ProductIcon {...props} name='smile' size={24} />,
  send: props => <ProductIcon {...props} name='send' />,
  mic: props => <ProductIcon {...props} name='mic' />,
}
