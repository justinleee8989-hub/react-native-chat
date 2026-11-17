import React, { useMemo } from 'react'
import { defaultLightTheme, mergeTheme, type ChatIcons } from '@kesha-antonov/react-native-chat'
import { useProductLayout } from './preferences'
import { ProductIcon } from './ProductIcon'
import { useProductTheme } from './theme'

// Memoized: the chat resolves its theme by identity, and a new theme object re-renders every
// bubble on screen, so each render of the chat page must hand it the same one.
export function useProductChatTheme () {
  const t = useProductTheme()
  const { desktop } = useProductLayout()
  return useMemo(() => mergeTheme(defaultLightTheme, {
    avatar: { size: 30 },
    composer: { minHeight: 40, maxHeight: 118, fieldPaddingH: 14, insetButtonWidth: 36 },
    sendButton: { size: 40 },
    voice: {
      idleBackground: 'transparent',
      idleIcon: t.text2,
    },
    wallpaper: { isEnabled: false },
    bubble: {
      hasTail: false,
      isTimeInline: false,
      outgoingGradient: ['#6E6BF2', '#0087F2'],
      outgoingGradientMode: 'window',
    },
    radii: { bubble: 20, bubbleGrouped: 6, inputField: 20, sendButton: 20 },
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
      background: t.bg,
      accent: t.accent,
      incomingBubble: t.bubble,
      outgoingBubble: t.accent,
      incomingText: t.text,
      outgoingText: t.onAccent,
      incomingMeta: t.text3,
      outgoingMeta: '#FFFFFFAA',
      incomingBubbleShadow: 'transparent',
      outgoingBubbleShadow: 'transparent',
      inputBackground: t.surface,
      inputBarBackground: t.bg,
      inputText: t.text,
      placeholder: t.text3,
      inputFieldBorder: t.line,
      composerIcon: t.text2,
      dayPillBackground: 'transparent',
      dayPillText: t.text3,
      surface: t.surface,
      error: t.danger,
      ticksRead: t.onAccent,
      ticksSent: '#FFFFFFAA',
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
  }), [t, desktop])
}
export const productChatIcons: ChatIcons = {
  paperclip: props => <ProductIcon {...props} name='plus' />,
  emoji: props => <ProductIcon {...props} name='smile' size={24} />,
  send: props => <ProductIcon {...props} name='send' />,
  mic: props => <ProductIcon {...props} name='mic' />,
}
