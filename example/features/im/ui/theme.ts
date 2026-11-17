import { chatListColors, type ChatListColors } from '@/components/chat-list/theme'
import { useProductScheme } from './preferences'
import { productPalette } from './tokens'

export function useProductTheme () {
  return productPalette[useProductScheme()]
}

/** Product-only adapter: library examples retain their own palette. */
export function useProductColors (): ChatListColors {
  const scheme = useProductScheme()
  const theme = productPalette[scheme]
  return { ...chatListColors[scheme], background: theme.bg, headerBackground: theme.page, headerTitle: theme.text, headerIcon: theme.text, name: theme.text, message: theme.text2, senderPrefix: theme.accent, attachment: theme.accent, typing: theme.accent, draft: theme.danger, date: theme.text3, check: theme.accent, badge: theme.accent, badgeMuted: theme.text3, badgeText: theme.onAccent, muteIcon: theme.text3, pinIcon: theme.text3, verified: theme.accent, online: theme.ok, divider: theme.line, pressed: theme.surface2, selectedRow: theme.accentWeak, checkbox: theme.accent, fab: theme.accent, subtitle: theme.text2, subtitleActive: theme.accent }
}
