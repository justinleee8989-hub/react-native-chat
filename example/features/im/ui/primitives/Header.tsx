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
            // 58 keeps the PC header the height the 36px title line gave it, so the list below
            // does not move; centred, the smaller title lines up with the header buttons.
            minHeight: desktop ? 58 : 62,
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
            style={[
              large ? styles.pageTitle : styles.detailTitle,
              { color: t.text, textAlign: desktopLarge ? 'left' : 'center' },
            ]}
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
