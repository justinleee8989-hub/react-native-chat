import React from 'react'
import { StyleSheet } from 'react-native'
import { CodeScanner } from 'react-native-vision-camera-barcode-scanner'
import { CameraGate } from './CameraGate'

/**
 * The live camera for 扫一扫 on Android: VisionCamera's ML Kit scanner, reading QR codes only, which
 * is faster than every format. iOS uses the system scanner instead (`QRScanner.ios.tsx`).
 */
export function QRScanner ({ active, onScanned }: { active: boolean, onScanned: (value: string) => void }) {
  return (
    <CameraGate>
      {() => (
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
      )}
    </CameraGate>
  )
}
