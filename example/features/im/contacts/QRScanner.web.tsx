import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useT } from '../i18n'

/** A browser has no camera scanner here (Safari has no barcode detection): 扫一扫 is phone-only. */
// Same props as the native scanner, which this file stands in for on web.
export function QRScanner (props: { active: boolean, onScanned: (value: string) => void }): React.ReactElement
export function QRScanner () {
  const tr = useT()
  return (
    <View style={styles.blocked}>
      <Text style={styles.text}>{tr('qr.webOnlyApp')}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  blocked: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', padding: 32 },
  text: { color: '#FFFFFF', fontSize: 15, lineHeight: 22, textAlign: 'center' },
})
