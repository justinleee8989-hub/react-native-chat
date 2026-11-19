import { launchImageLibraryAsync } from 'expo-image-picker'
import { loadImage } from 'react-native-nitro-image'
import { createBarcodeScanner } from 'react-native-vision-camera-barcode-scanner'

/**
 * 扫一扫 → 相册: lets the user pick a photo and reads the first QR code in it (ML Kit, as the live
 * scanner). Resolves to undefined when the picker is closed, and to '' when the photo has no code.
 */
export async function scanQRInPhoto () {
  const selection = await launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 })
  const asset = selection.canceled ? undefined : selection.assets[0]
  if (!asset)
    return undefined
  const image = await loadImage({ filePath: asset.uri.replace(/^file:\/\//, '') })
  const scanner = createBarcodeScanner({ barcodeFormats: ['qr-code'] })
  try {
    const barcodes = await scanner.scanCodesInImageAsync(image)
    return barcodes.find(barcode => barcode.rawValue)?.rawValue ?? ''
  } finally {
    image.dispose()
    scanner.dispose()
  }
}
