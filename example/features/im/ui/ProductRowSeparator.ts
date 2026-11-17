import { Platform, StyleSheet, type ViewStyle } from 'react-native'

export function productRowSeparatorStyle (visible: boolean, color: string): ViewStyle | undefined {
  if (!visible)
    return undefined
  return Platform.OS === 'web'
    ? { boxShadow: `inset 0 -0.5px 0 ${color}` }
    : { borderBottomWidth: StyleSheet.hairlineWidth, borderColor: color }
}
