import React from 'react'
import { KeyboardAvoidingView, Platform, Pressable, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useProductLayout } from '../ui/preferences'
import { ProductHeader } from '../ui/primitives'
import { ProductModal, useProductOverlayBounds } from '../ui/ProductModal'
import { useProductTheme } from '../ui/theme'

export function ProductPickerModal ({
  title,
  onClose,
  busy,
  children,
}: React.PropsWithChildren<{
  title: string
  onClose: () => void
  busy?: boolean
}>) {
  const t = useProductTheme()
  const { desktop } = useProductLayout()
  const bounds = useProductOverlayBounds()
  const insets = useSafeAreaInsets()
  const close = () => {
    if (!busy)
      onClose()
  }
  return (
    <ProductModal onRequestClose={close}>
      <KeyboardAvoidingView
        enabled={Platform.OS === 'ios'}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <View
          onAccessibilityEscape={close}
          style={{
            flex: 1,
            backgroundColor: t.scrim,
            alignItems: 'center',
            justifyContent: desktop ? 'center' : 'flex-end',
            paddingTop: desktop ? 24 : insets.top + 28,
            paddingBottom: desktop ? 24 : 0,
          }}
        >
          <View
            style={{
              width: '100%',
              maxWidth: desktop ? 480 : undefined,
              height: desktop ? Math.min(640, bounds.height - 48) : '100%',
              backgroundColor: t.bg,
              boxShadow: desktop ? t.shadow : undefined,
              borderRadius: desktop ? 18 : 0,
              borderTopLeftRadius: desktop ? 18 : 20,
              borderTopRightRadius: desktop ? 18 : 20,
              borderBottomLeftRadius: desktop ? 18 : 0,
              borderBottomRightRadius: desktop ? 18 : 0,
              overflow: 'hidden',
            }}
          >
            <ProductHeader
              title={title}
              backgroundColor={t.bg}
              right={
                <Pressable
                  accessibilityRole='button'
                  disabled={busy}
                  onPress={close}
                  style={{ padding: 12 }}
                >
                  <Text style={{ fontSize: 17, color: t.accent }}>取消</Text>
                </Pressable>
              }
            />
            {children}
          </View>
        </View>
      </KeyboardAvoidingView>
    </ProductModal>
  )
}
