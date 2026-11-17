import React from 'react'
import { Platform, StyleSheet, Text, View } from 'react-native'
import { useProductLayout } from './preferences'
import { ProductIcon } from './ProductIcon'
import { ProductPressable as Pressable } from './ProductPressable'
import { productRowSeparatorStyle } from './ProductRowSeparator'
import { useProductTheme } from './theme'

/** Use a 44-point ProductAvatar as leading; pass last for the final row of each section. */
export function ProductListRow ({
  title,
  subtitle,
  leading,
  trailing,
  trailingInteractive = false,
  onPress,
  onLongPress,
  chevron = false,
  small = false,
  side = false,
  last = false,
  danger = false,
  titleWeight = '600',
  backgroundColor,
}: {
  title: string
  subtitle?: string
  leading?: React.ReactNode
  trailing?: React.ReactNode
  trailingInteractive?: boolean
  onPress?: () => void
  onLongPress?: () => void
  chevron?: boolean
  small?: boolean
  side?: boolean
  last?: boolean
  danger?: boolean
  titleWeight?: '500' | '600'
  backgroundColor?: string
}) {
  const t = useProductTheme()
  const { desktop } = useProductLayout()
  const compactDesktop = side && desktop
  const content = (
    <>
      {leading}
      <View
        style={[
          {
            flex: 1,
            minWidth: 0,
            alignSelf: 'stretch',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
          },
          productRowSeparatorStyle(!last && !compactDesktop, t.line),
        ]}
      >
        <View style={{ flex: 1, minWidth: 0, gap: 3, paddingVertical: 10 }}>
          <Text
            numberOfLines={1}
            style={{
              fontSize: 16,
              lineHeight: 22,
              fontWeight: titleWeight,
              color: danger ? t.danger : t.text,
            }}
          >
            {title}
          </Text>
          {!!subtitle && (
            <Text numberOfLines={1} style={{ fontSize: 13, lineHeight: 18, color: t.text2 }}>
              {subtitle}
            </Text>
          )}
        </View>
        {trailing}
        {chevron && <ProductIcon name='chev' size={18} color={t.text3} />}
      </View>
    </>
  )
  const style = {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 14,
    paddingHorizontal: compactDesktop ? 14 : 20,
    marginHorizontal: compactDesktop ? 6 : 0,
    borderRadius: compactDesktop ? 12 : 0,
    minHeight: small ? 64 : 72,
  }
  const web =
    Platform.OS === 'web' && onLongPress
      ? {
        onContextMenu: (event: { preventDefault: () => void, stopPropagation: () => void }) => {
          event.preventDefault()
          event.stopPropagation()
          onLongPress()
        },
      }
      : {}
  if (trailingInteractive && onPress)
    return (
      <View style={[style, { gap: 12, backgroundColor: backgroundColor ?? t.page }]}>
        <Pressable
          accessibilityRole='button'
          onPress={onPress}
          onLongPress={onLongPress}
          style={({ pressed }) => ({
            flex: 1,
            minWidth: 0,
            alignSelf: 'stretch',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 14,
            backgroundColor: pressed ? t.surface2 : undefined,
          })}
        >
          {leading}
          <View style={{ flex: 1, minWidth: 0, gap: 3, paddingVertical: 10 }}>
            <Text
              numberOfLines={1}
              style={{
                fontSize: 16,
                lineHeight: 22,
                fontWeight: titleWeight,
                color: danger ? t.danger : t.text,
              }}
            >
              {title}
            </Text>
            {!!subtitle && (
              <Text numberOfLines={1} style={{ fontSize: 13, lineHeight: 18, color: t.text2 }}>
                {subtitle}
              </Text>
            )}
          </View>
        </Pressable>
        {trailing}
        {!last && !compactDesktop && (
          <View
            pointerEvents='none'
            style={[
              {
                position: 'absolute',
                left: leading ? 78 : 20,
                right: 20,
                bottom: 0,
                height: Platform.OS === 'web' ? 0 : StyleSheet.hairlineWidth,
              },
              productRowSeparatorStyle(true, t.line),
            ]}
          />
        )}
      </View>
    )
  return onPress || onLongPress ? (
    <Pressable
      {...web}
      accessibilityRole='button'
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [
        style,
        { backgroundColor: pressed ? t.surface2 : (backgroundColor ?? t.page) },
      ]}
    >
      {content}
    </Pressable>
  ) : (
    <View style={[style, { backgroundColor: backgroundColor ?? t.page }]}>{content}</View>
  )
}
