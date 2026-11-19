import { scanFromURLAsync } from 'expo-camera'
import { launchImageLibraryAsync } from 'expo-image-picker'

/**
 * 扫一扫 → 相册 on iOS: lets the user pick a photo and reads the first QR code in it with the
 * system's detector (expo-camera), since ML Kit is Android-only here (see `QRScanner.ios.tsx`).
 * Resolves to undefined when the picker is closed, and to '' when the photo has no code.
 */
export async function scanQRInPhoto () {
  const selection = await launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 })
  const asset = selection.canceled ? undefined : selection.assets[0]
  if (!asset)
    return undefined
  const codes = await scanFromURLAsync(asset.uri, ['qr'])
  return codes.find(code => code.data)?.data ?? ''
}
