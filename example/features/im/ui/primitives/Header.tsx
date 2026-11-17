import React from 'react'
import { Text, View } from 'react-native'
import { useProductLayout } from '../preferences'
import { ProductIcon } from '../ProductIcon'
import { ProductPressable as Pressable } from '../ProductPressable'
import { useProductTheme } from '../theme'
import { styles } from './styles'

export function ProductHeader ({
  title,
  subtitle,
  large,
  onBack,
  right,
  backgroundColor,
  detail = false,
}: {
  title: string
  subtitle?: string
  large?: boolean
  onBack?: () => void
  right?: React.ReactNode
  backgroundColor?: string
  detail?: boolean
}) {
  const t = useProductTheme()
  const { desktop } = useProductLayout()
  const desktopLarge = large && desktop
  return (
    <View
      style={[
        styles.header,
        detail && desktop && { minHeight: 60 },
        large && [
          styles.largeHeader,
          {
            paddingLeft: desktop ? 18 : 20,
            paddingTop: desktop ? 16 : 10,
            paddingBottom: desktop ? 6 : 8,
            paddingRight: desktop ? 8 : 10,
            alignItems: desktop ? 'flex-end' : 'center',
            minHeight: desktop ? 0 : 62,
          },
        ],
        { backgroundColor: backgroundColor || t.bg },
      ]}
    >
      {onBack && (
        <Pressable
          accessibilityRole='button'
          accessibilityLabel='返回'
          onPress={onBack}
          style={({ pressed }) => [
            styles.icon,
            { borderRadius: 22, backgroundColor: pressed ? t.surface2 : undefined },
          ]}
        >
          <ProductIcon name='back' size={24} color={t.text} />
        </Pressable>
      )}
      {!onBack && !large && <View style={styles.icon} />}
      <View pointerEvents='none' style={desktopLarge ? styles.heading : styles.centeredHeading}>
        {!!title && (
          <Text
            accessibilityRole='header'
            numberOfLines={1}
            style={{
              color: t.text,
              fontSize: large ? (desktop ? 24 : 18) : 17,
              lineHeight: large ? (desktop ? 36 : 24) : 22,
              fontWeight: desktopLarge ? '700' : '600',
              letterSpacing: desktopLarge ? -0.3 : undefined,
              textAlign: desktopLarge ? 'left' : 'center',
            }}
          >
            {title}
          </Text>
        )}
        {subtitle && (
          <Text style={{ color: t.text2, fontSize: 12, lineHeight: 15, textAlign: 'center' }}>
            {subtitle}
          </Text>
        )}
      </View>
      <View style={{ marginLeft: 'auto', minWidth: large ? 0 : 44 }}>{right}</View>
    </View>
  )
}
