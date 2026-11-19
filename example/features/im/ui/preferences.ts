import { useEffect, useSyncExternalStore } from 'react'
import { useWindowDimensions } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useColorScheme } from '@/hooks/use-color-scheme'
import { type LanguageChoice, parseLanguageChoice } from '../i18n/translate.ts'
import { parseChatTheme, type ChatThemeId } from './chat-theme'
import { parseChatWallpaper, type ChatWallpaperId } from './chat-wallpaper'
import { parseAppearance, resolveAppearance, type ProductAppearance } from './preferences-model'

let phonePreview = false
let initialized = false
const listeners = new Set<() => void>()
const subscribe = (listener: () => void) => {
  listeners.add(listener); return () => {
    listeners.delete(listener)
  }
}
const emit = () => listeners.forEach(listener => listener())

/**
 * One choice saved on this device. A choice made before the saved one has loaded wins over it.
 */
function stored<T extends string> (storageKey: string, initial: T, parse: (value: string | null) => T) {
  let value = initial
  let changed = false
  return {
    initial,
    get: () => value,
    restore: () => {
      void AsyncStorage.getItem(storageKey).then(saved => {
        if (!changed) {
          value = parse(saved); emit()
        }
      }).catch(() => {})
    },
    set: (next: T) => {
      changed = true
      value = next
      emit()
      void AsyncStorage.setItem(storageKey, next).catch(() => {})
    },
  }
}
const appearance = stored<ProductAppearance>('openim.product.appearance', 'auto', parseAppearance)
const chatWallpaper = stored<ChatWallpaperId>('openim.product.chat-wallpaper', 'plain', parseChatWallpaper)
const chatTheme = stored<ChatThemeId>('openim.product.chat-theme', 'default', parseChatTheme)
// The picked photo for the 相册图片 wallpaper: a file in the app's documents, or a data URL on web.
const chatWallpaperPhoto = stored<string>('openim.product.chat-wallpaper-photo', '', value => value ?? '')
// 我的 → 语言: a language, or the system's.
const language = stored<LanguageChoice>('openim.product.language', 'auto', parseLanguageChoice)
function restore () {
  if (initialized)
    return
  initialized = true
  appearance.restore()
  chatWallpaper.restore()
  chatTheme.restore()
  chatWallpaperPhoto.restore()
  language.restore()
}
function useStored<T extends string> (choice: ReturnType<typeof stored<T>>) {
  useEffect(restore, [])
  return useSyncExternalStore(subscribe, choice.get, () => choice.initial)
}

// 我的 → 外观: these apply to every chat on this device.
export const setChatWallpaper = chatWallpaper.set
export const useChatWallpaper = () => useStored(chatWallpaper)
export const setChatWallpaperPhoto = chatWallpaperPhoto.set
export const useChatWallpaperPhoto = () => useStored(chatWallpaperPhoto)
export const setChatTheme = chatTheme.set
export const useChatTheme = () => useStored(chatTheme)
export const setLanguageChoice = language.set
export const useLanguageChoice = () => useStored(language)
export const setProductAppearance = appearance.set
export const useProductAppearance = () => useStored(appearance)
export function setPhonePreview (value: boolean) {
  phonePreview = value; emit()
}
export function useProductScheme () {
  return resolveAppearance(useProductAppearance(), useColorScheme())
}
export function useProductLayout () {
  const preview = useSyncExternalStore(subscribe, () => phonePreview, () => false)
  const { width } = useWindowDimensions()
  return { desktop: width >= 900 && !preview, phonePreview: width >= 900 && preview }
}
