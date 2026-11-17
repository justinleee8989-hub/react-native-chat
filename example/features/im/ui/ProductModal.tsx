import React from 'react'
import {
  Modal,
  Platform,
  View,
  useWindowDimensions,
  type ModalProps,
  type ViewProps,
} from 'react-native'
import { useProductLayout } from './preferences'
import { productMetrics } from './tokens'

export function productOverlayGeometry (
  width: number,
  height: number,
  phonePreview: boolean,
  web: boolean
) {
  if (!web || width < productMetrics.desktop)
    return { width, height, topInset: 0, radius: 0 }
  return {
    width: Math.min(phonePreview ? 390 : productMetrics.frameWidth, width - 48),
    height: Math.min(phonePreview ? 844 : productMetrics.frameHeight, height - 48),
    topInset: phonePreview ? 36 : 0,
    radius: 18,
  }
}

export function useProductOverlayBounds () {
  const { width, height } = useWindowDimensions()
  const { phonePreview } = useProductLayout()
  const frame = productOverlayGeometry(width, height, !!phonePreview, Platform.OS === 'web')
  return {
    frameX: (width - frame.width) / 2,
    frameY: (height - frame.height) / 2,
    contentHeight: frame.height - frame.topInset,
    x: (width - frame.width) / 2,
    y: (height - frame.height) / 2 + frame.topInset,
    width: frame.width,
    height: frame.height - frame.topInset,
    radius: frame.radius,
    topInset: frame.topInset,
  }
}

/** Match the web product frame rather than dimming the entire browser window. */
export function ProductOverlayFrame ({ children, ...props }: ViewProps) {
  const frame = useProductOverlayBounds()
  return (
    <View accessibilityViewIsModal {...props} style={{ flex: 1 }}>
      <View
        style={{
          position: 'absolute',
          left: frame.x,
          top: frame.y,
          width: frame.width,
          height: frame.height,
          borderRadius: frame.radius,
          overflow: 'hidden',
        }}
      >
        {children}
      </View>
    </View>
  )
}

export function ProductModal ({ children, ...props }: ModalProps) {
  return (
    <Modal transparent visible animationType='fade' {...props}>
      <ProductOverlayFrame accessibilityViewIsModal>{children}</ProductOverlayFrame>
    </Modal>
  )
}
