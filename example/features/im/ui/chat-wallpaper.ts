import type { MessageKey } from '../i18n/translate.ts'
/**
 * Chat wallpaper (聊天壁纸) choices: the plain page color, a swirl gradient (the chat library's
 * `theme.wallpaper`, with the doodle tile `assets/images/chat-pattern.png` over it), a solid color,
 * or a photo the user picked. Gradients and colors have a day and a night set, following 深色模式.
 */
export type ChatWallpaperKind = 'plain' | 'gradient' | 'color' | 'photo'

export type ChatWallpaperId =
  | 'plain'
  | 'classic' | 'iris' | 'mint' | 'dawn' | 'sakura'
  | 'gray' | 'blue' | 'cyan' | 'green' | 'cream' | 'apricot' | 'rose' | 'lilac' | 'sand' | 'navy' | 'plum' | 'ink'
  | 'photo'

export interface ChatWallpaperPreset {
  id: ChatWallpaperId
  /** The name shown under its thumbnail. */
  labelKey: MessageKey
  kind: ChatWallpaperKind
  /** Four gradient colors, or the one solid color; none for the plain page and a photo. */
  light?: string[]
  dark?: string[]
}

export const chatWallpapers: ChatWallpaperPreset[] = [
  { id: 'plain', labelKey: 'wallpaper.plain', kind: 'plain' },
  // The library's own day and night wallpapers.
  { id: 'classic', labelKey: 'wallpaper.classic', kind: 'gradient', light: ['#DBDDBB', '#6BA587', '#D5D88D', '#88B884'], dark: ['#0E141A', '#172431', '#0F171E', '#141C2B'] },
  // Matches the blue-violet of sent bubbles.
  { id: 'iris', labelKey: 'wallpaper.iris', kind: 'gradient', light: ['#C9D2FF', '#9DB1F7', '#D9CCFF', '#AFC6FF'], dark: ['#1A1F4A', '#2A3478', '#1E2257', '#33408C'] },
  { id: 'mint', labelKey: 'wallpaper.mint', kind: 'gradient', light: ['#BFE8D3', '#8FD1B4', '#D3F0DF', '#A2DCC4'], dark: ['#0F2A22', '#17463A', '#123329', '#1D5546'] },
  { id: 'dawn', labelKey: 'wallpaper.dawn', kind: 'gradient', light: ['#FFD2B8', '#FFB5A0', '#FFE1C2', '#FFC3AE'], dark: ['#3A1D14', '#5A2C1F', '#442217', '#6B3524'] },
  { id: 'sakura', labelKey: 'wallpaper.sakura', kind: 'gradient', light: ['#FFD3E3', '#F5B3CF', '#FFE0EA', '#E9BEE0'], dark: ['#3A1728', '#5A2340', '#441B30', '#682B4C'] },
  // Solid colors, twelve for four even rows: soft by day, deep by night, so bubbles stay readable.
  { id: 'gray', labelKey: 'wallpaper.gray', kind: 'color', light: ['#E6E9EE'], dark: ['#1B1D22'] },
  { id: 'blue', labelKey: 'wallpaper.blue', kind: 'color', light: ['#DCEBFF'], dark: ['#13233A'] },
  { id: 'cyan', labelKey: 'wallpaper.cyan', kind: 'color', light: ['#D6F0F4'], dark: ['#0F2A2F'] },
  { id: 'green', labelKey: 'wallpaper.green', kind: 'color', light: ['#DDF2E2'], dark: ['#132A1B'] },
  { id: 'cream', labelKey: 'wallpaper.cream', kind: 'color', light: ['#FFF3D3'], dark: ['#2E2714'] },
  { id: 'apricot', labelKey: 'wallpaper.apricot', kind: 'color', light: ['#FFE4D1'], dark: ['#33200F'] },
  { id: 'rose', labelKey: 'wallpaper.rose', kind: 'color', light: ['#FFDFE5'], dark: ['#341720'] },
  { id: 'lilac', labelKey: 'wallpaper.lilac', kind: 'color', light: ['#EAE2FF'], dark: ['#221A3A'] },
  { id: 'sand', labelKey: 'wallpaper.sand', kind: 'color', light: ['#EFE6D8'], dark: ['#2A251E'] },
  { id: 'navy', labelKey: 'wallpaper.navy', kind: 'color', light: ['#2E3A59'], dark: ['#151C2E'] },
  { id: 'plum', labelKey: 'wallpaper.plum', kind: 'color', light: ['#4A2F4F'], dark: ['#24172A'] },
  { id: 'ink', labelKey: 'wallpaper.ink', kind: 'color', light: ['#3A3B40'], dark: ['#1A1A1D'] },
  { id: 'photo', labelKey: 'wallpaper.photo', kind: 'photo' },
]

export function parseChatWallpaper (value: string | null): ChatWallpaperId {
  return chatWallpapers.some(item => item.id === value) ? value as ChatWallpaperId : 'plain'
}

/** A preset, falling back to the plain page for an id no longer offered. */
export function chatWallpaperOf (id: ChatWallpaperId) {
  return chatWallpapers.find(item => item.id === id) ?? chatWallpapers[0]
}

/** The presets of one kind, in the order they are offered. */
export function chatWallpapersOf (kind: ChatWallpaperKind) {
  return chatWallpapers.filter(item => item.kind === kind)
}

/**
 * What a wallpaper draws in a scheme. A photo without a saved picture draws the plain page, so a
 * cleared or lost photo never leaves an empty chat.
 */
export function resolveChatWallpaper (id: ChatWallpaperId, scheme: 'light' | 'dark', photo: string) {
  const preset = chatWallpaperOf(id)
  const colors = scheme === 'dark' ? preset.dark : preset.light
  if (preset.kind === 'gradient' && colors)
    return { kind: 'gradient' as const, colors }
  if (preset.kind === 'color' && colors)
    return { kind: 'color' as const, color: colors[0] }
  if (preset.kind === 'photo' && photo)
    return { kind: 'photo' as const, uri: photo }
  return { kind: 'plain' as const }
}

export type ResolvedChatWallpaper = ReturnType<typeof resolveChatWallpaper>
