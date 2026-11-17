import { AppState, Platform } from 'react-native'
import { watchNativeForeground, watchWebForeground } from './foreground-events'

export function subscribeForeground (onResume: () => void) {
  if (Platform.OS === 'web' && typeof document !== 'undefined' && typeof window !== 'undefined')
    return watchWebForeground(document, window, onResume)
  return watchNativeForeground(AppState, onResume)
}
