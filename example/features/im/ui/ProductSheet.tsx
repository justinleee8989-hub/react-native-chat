import React from 'react'
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useProductLayout } from './preferences'
import { ProductModal } from './ProductModal'
import { ProductPressable as Pressable } from './ProductPressable'
import { useProductTheme } from './theme'

export interface ProductSheetItem {
  key?: string
  title: string
  onPress: () => void
  icon?: React.ReactNode
  trailing?: React.ReactNode
  danger?: boolean
  disabled?: boolean
}

export function ProductSheet ({
  children,
  onClose,
  busy = false,
  title,
  subtitle,
  items,
  cancelLabel = '取消',
}: React.PropsWithChildren<{
  onClose: () => void
  busy?: boolean
  title?: string
  subtitle?: string
  items?: ProductSheetItem[]
  cancelLabel?: string
}>) {
  const t = useProductTheme()
  const insets = useSafeAreaInsets()
  const { desktop } = useProductLayout()
  const close = () => {
    if (!busy)
      onClose()
  }
  return (
    <ProductModal transparent visible animationType='fade' onRequestClose={close}>
      <View
        accessibilityViewIsModal
        onAccessibilityEscape={close}
        style={{
          flex: 1,
          alignItems: 'center',
          paddingTop: 8,
          paddingBottom: desktop ? 8 : 10 + insets.bottom,
          paddingHorizontal: desktop ? 16 : 8,
          backgroundColor: t.scrim,
          justifyContent: desktop ? 'center' : 'flex-end',
        }}
      >
        <Pressable
          accessibilityRole='button'
          accessibilityLabel='关闭'
          disabled={busy}
          onPress={close}
          style={StyleSheet.absoluteFill}
        />
        <ScrollView
          keyboardShouldPersistTaps='handled'
          style={{
            flexGrow: 0,
            maxHeight: '85%',
            width: '100%',
            maxWidth: desktop ? 420 : undefined,
          }}
          contentContainerStyle={desktop ? { padding: 40 } : undefined}
        >
          <View
            style={{
              borderRadius: 16,
              overflow: 'hidden',
              backgroundColor: t.surface,
              boxShadow: desktop ? t.shadow : undefined,
            }}
          >
            {(!!title || !!subtitle) && (
              <View
                style={{
                  paddingVertical: 14,
                  paddingHorizontal: 20,
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  borderColor: t.line,
                }}
              >
                {!!title && (
                  <Text
                    style={{
                      fontSize: 14,
                      lineHeight: 18,
                      fontWeight: '600',
                      color: t.text,
                      textAlign: 'center',
                    }}
                  >
                    {title}
                  </Text>
                )}
                {!!subtitle && (
                  <Text
                    style={{ fontSize: 13, lineHeight: 18, color: t.text2, textAlign: 'center' }}
                  >
                    {subtitle}
                  </Text>
                )}
              </View>
            )}
            {items?.map((item, index) => (
              <Pressable
                key={item.key ?? item.title}
                accessibilityRole='button'
                accessibilityLabel={item.title}
                accessibilityState={{ disabled: busy || item.disabled }}
                disabled={busy || item.disabled}
                onPress={item.onPress}
                style={({ pressed }) => ({
                  minHeight: 56,
                  paddingHorizontal: 20,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: item.icon ? 'flex-start' : 'center',
                  gap: 10,
                  borderTopWidth: Platform.OS === 'web' ? 0 : index ? StyleSheet.hairlineWidth : 0,
                  boxShadow:
                    Platform.OS === 'web' && index ? `inset 0 0.5px 0 ${t.line}` : undefined,
                  borderColor: t.line,
                  backgroundColor: pressed ? t.surface2 : t.surface,
                  opacity: item.disabled ? 0.38 : 1,
                })}
              >
                {item.icon}
                <Text
                  style={{
                    flex: item.icon || item.trailing ? 1 : undefined,
                    fontSize: 17,
                    fontWeight: '400',
                    color: item.danger ? t.danger : t.text,
                  }}
                >
                  {item.title}
                </Text>
                {item.trailing}
              </Pressable>
            ))}
            {children && (
              <View
                pointerEvents={busy ? 'none' : 'auto'}
                style={{ padding: items ? 0 : 20, gap: items ? 0 : 16 }}
              >
                {children}
              </View>
            )}
          </View>
          <Pressable
            accessibilityRole='button'
            accessibilityLabel={cancelLabel}
            accessibilityState={{ disabled: busy }}
            disabled={busy}
            onPress={close}
            style={({ pressed }) => ({
              marginTop: 8,
              height: 56,
              borderRadius: 16,
              boxShadow: desktop ? t.shadow : undefined,
              backgroundColor: pressed ? t.surface2 : t.surface,
              alignItems: 'center',
              justifyContent: 'center',
            })}
          >
            <Text style={{ fontSize: 17, fontWeight: '600', color: t.text }}>{cancelLabel}</Text>
          </Pressable>
        </ScrollView>
      </View>
    </ProductModal>
  )
}
