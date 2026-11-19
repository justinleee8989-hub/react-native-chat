import React, { useCallback } from 'react'
import { StyleSheet } from 'react-native'
import { Camera, type CameraDevice, isScannedCode, type ScannedObject, type ScannedObjectType, useObjectOutput } from 'react-native-vision-camera'
import { CameraGate } from './CameraGate'

// Kept outside the component: the output is made again whenever this list changes.
const QR_ONLY: ScannedObjectType[] = ['qr']

/**
 * The live camera for 扫一扫 on iOS: VisionCamera's object output, which is the system's own scanner
 * (AVFoundation), reading QR codes only. ML Kit, which Android uses, has no build for the arm64
 * simulator, and the system scanner needs nothing extra in the app.
 */
export function QRScanner ({ active, onScanned }: { active: boolean, onScanned: (value: string) => void }) {
  return (
    <CameraGate>
      {device => <ObjectScanner device={device} active={active} onScanned={onScanned} />}
    </CameraGate>
  )
}

function ObjectScanner ({ device, active, onScanned }: { device: CameraDevice, active: boolean, onScanned: (value: string) => void }) {
  const onObjectsScanned = useCallback((objects: ScannedObject[]) => {
    const value = objects.filter(isScannedCode).find(code => code.value)?.value
    if (value)
      onScanned(value)
  }, [onScanned])
  const output = useObjectOutput({ types: QR_ONLY, onObjectsScanned })
  return <Camera style={StyleSheet.absoluteFill} device={device} isActive={active} outputs={[output]} />
}
