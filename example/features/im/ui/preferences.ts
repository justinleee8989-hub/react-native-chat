import { useEffect, useSyncExternalStore } from 'react'
import { useWindowDimensions } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useColorScheme } from '@/hooks/use-color-scheme'
import { parseAppearance, resolveAppearance, type ProductAppearance } from './preferences-model'

const key = 'openim.product.appearance'
let appearance: ProductAppearance = 'auto'
let phonePreview = false
let initialized = false
let changed = false
const listeners = new Set<() => void>()
const subscribe = (listener: () => void) => {
  listeners.add(listener); return () => {
    listeners.delete(listener)
  }
}
const emit = () => listeners.forEach(listener => listener())
function restore () {
  if (initialized)
    return
  initialized = true
  void AsyncStorage.getItem(key).then(value => {
    if (!changed) {
      appearance = parseAppearance(value); emit()
    }
  }).catch(() => {})
}
export function setProductAppearance (value: ProductAppearance) {
  changed = true
  appearance = value
  emit()
  void AsyncStorage.setItem(key, value).catch(() => {})
}
export function setPhonePreview (value: boolean) {
  phonePreview = value; emit()
}
export function useProductAppearance () {
  useEffect(restore, [])
  return useSyncExternalStore(subscribe, () => appearance, () => 'auto' as const)
}
export function useProductScheme () {
  return resolveAppearance(useProductAppearance(), useColorScheme())
}
export function useProductLayout () {
  const preview = useSyncExternalStore(subscribe, () => phonePreview, () => false)
  const { width } = useWindowDimensions()
  return { desktop: width >= 900 && !preview, phonePreview: width >= 900 && preview }
}
