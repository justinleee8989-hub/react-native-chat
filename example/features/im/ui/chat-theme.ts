import type { ViewStyle } from 'react-native'
import type { MessageKey } from '../i18n/translate.ts'

/**
 * Chat theme (聊天主题) presets: how sent messages look in every chat. Each sets the sent bubble's
 * fill (a gradient, or one color), its text and meta colors, the chat's accent (send button,
 * links), and the bubble shape: its radius and the sharper corner a group ends on. The page
 * colors, the wallpaper (聊天壁纸) and 深色模式 are chosen separately; each preset has a day and a
 * night look.
 */
export type ChatThemeId = 'default' | 'classic' | 'ocean' | 'sunset' | 'violet' | 'graphite'

export interface ChatThemeLook {
  /** Sent bubbles' gradient, top to bottom of the window; null fills them with `bubble`. */
  gradient: string[] | null
  /** The sent bubble's color (the gradient's last stop when there is one). */
  bubble: string
  text: string
  meta: string
  /** Read ticks, when they differ from the meta color. */
  ticks?: string
  /** Links in sent messages, when they differ from the text color. */
  link?: string
  accent: string
}

export interface ChatThemePreset {
  id: ChatThemeId
  /** The name shown under its thumbnail. */
  labelKey: MessageKey
  radius: number
  /** The inner bottom corner of the last bubble in a group, pointing at its sender. */
  corner: number
  light: ChatThemeLook
  dark: ChatThemeLook
}

const white = { text: '#FFFFFF', meta: '#FFFFFFAA', ticks: '#FFFFFF' }

export const chatThemes: ChatThemePreset[] = [
  {
    id: 'default',
    labelKey: 'theme.default',
    radius: 20,
    corner: 6,
    light: { ...white, gradient: ['#6E6BF2', '#0087F2'], bubble: '#3366FF', accent: '#3366FF' },
    dark: { ...white, gradient: ['#6E6BF2', '#0087F2'], bubble: '#5C85FF', accent: '#5C85FF' },
  },
  // The chat library's own day and night colors, with its sharp tail corner.
  {
    id: 'classic',
    labelKey: 'theme.classic',
    radius: 17,
    corner: 2,
    light: { gradient: null, bubble: '#EFFFDE', text: '#000000', meta: '#70B15C', ticks: '#5DB050', link: '#2678B6', accent: '#229AF0' },
    dark: { ...white, gradient: ['#9F3EAA', '#8146D7', '#4272DF', '#258DE5'], bubble: '#258DE5', accent: '#229AF0' },
  },
  {
    id: 'ocean',
    labelKey: 'theme.ocean',
    radius: 20,
    corner: 6,
    light: { ...white, gradient: ['#1FC8DB', '#0E8FD6'], bubble: '#0E8FD6', accent: '#0E8FD6' },
    dark: { ...white, gradient: ['#1592B8', '#0B6FA8'], bubble: '#0B6FA8', accent: '#2BA8E0' },
  },
  {
    id: 'sunset',
    labelKey: 'theme.sunset',
    radius: 20,
    corner: 6,
    light: { ...white, gradient: ['#FF9A62', '#F5487F'], bubble: '#F5487F', accent: '#F5487F' },
    dark: { ...white, gradient: ['#E0765A', '#C93C6E'], bubble: '#C93C6E', accent: '#FF6B8F' },
  },
  {
    id: 'violet',
    labelKey: 'theme.violet',
    radius: 20,
    corner: 6,
    light: { ...white, gradient: ['#B388FF', '#7C4DFF'], bubble: '#7C4DFF', accent: '#7C4DFF' },
    dark: { ...white, gradient: ['#9575E6', '#6A3FE0'], bubble: '#6A3FE0', accent: '#9F85FF' },
  },
  // Squarer bubbles in a neutral ink, for a quieter chat.
  {
    id: 'graphite',
    labelKey: 'theme.graphite',
    radius: 10,
    corner: 3,
    light: { ...white, gradient: null, bubble: '#2B2B30', accent: '#2B2B30' },
    dark: { ...white, gradient: null, bubble: '#3A3A42', accent: '#8E8E99' },
  },
]

export function parseChatTheme (value: string | null): ChatThemeId {
  return chatThemes.some(item => item.id === value) ? value as ChatThemeId : 'default'
}

/** A preset, falling back to 默认 for an id no longer offered. */
export function chatThemeOf (id: ChatThemeId) {
  return chatThemes.find(item => item.id === id) ?? chatThemes[0]
}

/**
 * A sent bubble's fill as a view style, for previews: its gradient as a CSS background image (as the
 * library's own bubble draws it), over the plain color where that is not supported.
 */
export function sentFillStyle (look: ChatThemeLook): ViewStyle {
  if (!look.gradient)
    return { backgroundColor: look.bubble }
  const css = `linear-gradient(to bottom, ${look.gradient.join(', ')})`
  return { backgroundColor: look.bubble, backgroundImage: css, experimental_backgroundImage: css } as ViewStyle
}
