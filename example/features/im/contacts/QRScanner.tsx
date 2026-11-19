import React, { useEffect } from 'react'
import { Linking, StyleSheet, Text, View } from 'react-native'
import { useCameraDevice, useCameraPermission } from 'react-native-vision-camera'
import { CodeScanner } from 'react-native-vision-camera-barcode-scanner'
import { ProductButton } from '../ui/primitives'

/**
 * The live camera for 扫一扫 (VisionCamera's ML Kit scanner, on iOS and Android), reading QR codes
 * only, which is faster than every format. Asks for the camera once; denied, it says so and offers
 * the system settings, where the permission can be turned back on. Without a camera it says so.
 */
export function QRScanner ({ active, onScanned }: { active: boolean, onScanned: (value: string) => void }) {
  const { hasPermission, canRequestPermission, requestPermission } = useCameraPermission()
  // The scanner throws without a rear camera (an emulator, a tablet without one): say so instead,
  // and 相册 still reads codes from photos.
  const device = useCameraDevice('back')
  useEffect(() => {
    if (!hasPermission && canRequestPermission)
      void requestPermission()
  }, [hasPermission, canRequestPermission, requestPermission])
  if (!hasPermission)
    return (
      <View style={styles.blocked}>
        <Text style={styles.blockedText}>
          {canRequestPermission ? '正在请求相机权限…' : '需要相机权限才能扫码，请在系统设置中允许。'}
        </Text>
        {!canRequestPermission && (
          <ProductButton title='打开设置' variant='soft' onPress={() => void Linking.openSettings()} />
        )}
      </View>
    )
  if (!device)
    return (
      <View style={styles.blocked}>
        <Text style={styles.blockedText}>没有可用的相机，可以从相册选择二维码图片。</Text>
      </View>
    )
  return (
    <CodeScanner
      style={StyleSheet.absoluteFill}
      isActive={active}
      barcodeFormats={['qr-code']}
      onBarcodeScanned={barcodes => {
        const value = barcodes.find(barcode => barcode.rawValue)?.rawValue
        if (value)
          onScanned(value)
      }}
      // A frame the scanner could not read is skipped; the next one is tried.
      onError={() => {}}
    />
  )
}

const styles = StyleSheet.create({
  blocked: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 },
  blockedText: { color: '#FFFFFF', fontSize: 15, lineHeight: 22, textAlign: 'center' },
})
