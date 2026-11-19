import React, { useEffect } from 'react'
import { Linking, StyleSheet, Text, View } from 'react-native'
import { type CameraDevice, useCameraDevice, useCameraPermission } from 'react-native-vision-camera'
import { useT } from '../i18n'
import { ProductButton } from '../ui/primitives'

/**
 * What both QR scanners need before the camera opens: asks for the camera once; denied, it says so
 * and offers the system settings, where the permission can be turned back on. Without a rear camera
 * (an emulator, a tablet without one) it says so, and 相册 still reads codes from photos. Otherwise
 * it shows the scanner for that camera.
 */
export function CameraGate ({ children }: { children: (device: CameraDevice) => React.ReactElement }) {
  const tr = useT()
  const { hasPermission, canRequestPermission, requestPermission } = useCameraPermission()
  const device = useCameraDevice('back')
  useEffect(() => {
    if (!hasPermission && canRequestPermission)
      void requestPermission()
  }, [hasPermission, canRequestPermission, requestPermission])
  if (!hasPermission)
    return (
      <View style={styles.blocked}>
        <Text style={styles.blockedText}>
          {canRequestPermission ? tr('scan.requestingCamera') : tr('scan.needCamera')}
        </Text>
        {!canRequestPermission && (
          <ProductButton title={tr('scan.openSettings')} variant='soft' onPress={() => void Linking.openSettings()} />
        )}
      </View>
    )
  if (!device)
    return (
      <View style={styles.blocked}>
        <Text style={styles.blockedText}>{tr('scan.noCamera')}</Text>
      </View>
    )
  return children(device)
}

const styles = StyleSheet.create({
  blocked: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 },
  blockedText: { color: '#FFFFFF', fontSize: 15, lineHeight: 22, textAlign: 'center' },
})
