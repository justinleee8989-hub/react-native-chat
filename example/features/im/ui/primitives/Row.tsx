import React, { useContext } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { ProductIcon } from '../ProductIcon'
import { ProductPressable as Pressable } from '../ProductPressable'
import { useProductTheme } from '../theme'
import { RowSeparator } from './RowSeparator'
import { styles } from './styles'

export function ProductRow ({
  title,
  subtitle,
  leading,
  trailing,
  trailingInteractive = false,
  onPress,
  onLongPress,
  danger,
  separatorInset,
  separator,
  chevron,
  big = false,
  centered = false,
}: {
  title: string
  subtitle?: string
  leading?: React.ReactNode
  trailing?: React.ReactNode
  trailingInteractive?: boolean
  onPress?: () => void
  onLongPress?: () => void
  danger?: boolean
  separatorInset?: number
  separator?: boolean
  chevron?: boolean
  big?: boolean
  centered?: boolean
}) {
  const t = useProductTheme()
  const groupedSeparator = useContext(RowSeparator)
  const showSeparator = separator ?? groupedSeparator
  const rowStyle = [
    styles.row,
    big && { padding: 16 },
    { backgroundColor: t.surface, borderColor: t.line, borderBottomWidth: 0 },
  ]
  const content = (
    <>
      {leading}
      <View
        style={[
          styles.heading,
          big && leading ? { marginLeft: 4 } : undefined,
          centered && { alignItems: 'center' },
        ]}
      >
        <Text
          style={{
            fontSize: big ? 20 : 16,
            lineHeight: big ? 26 : 22,
            fontWeight: big ? '600' : undefined,
            color: danger ? t.danger : t.text,
          }}
        >
          {title}
        </Text>
        {subtitle && (
          <Text
            style={{
              fontSize: big ? 14 : 13,
              lineHeight: big ? 20 : 18,
              color: t.text2,
              marginTop: big ? 2 : 1,
            }}
          >
            {subtitle}
          </Text>
        )}
      </View>
      {trailing}
      {(chevron ?? (!!onPress && !centered)) && (
        <View style={{ marginRight: -4 }}>
          <ProductIcon name='chev' size={18} color={t.text3} />
        </View>
      )}
      {showSeparator && (
        <View
          style={{
            position: 'absolute',
            left: separatorInset ?? 16,
            right: 0,
            top: 0,
            height: StyleSheet.hairlineWidth,
            backgroundColor: t.line,
          }}
        />
      )}
    </>
  )
  if (trailingInteractive && onPress)
    return (
      <View style={rowStyle}>
        <Pressable
          accessibilityRole='button'
          onPress={onPress}
          onLongPress={onLongPress}
          style={({ pressed }) => ({
            flex: 1,
            minWidth: 0,
            flexDirection: 'row',
            alignItems: 'center',
            alignSelf: 'stretch',
            gap: 12,
            backgroundColor: pressed ? t.surface2 : undefined,
          })}
        >
          {leading}
          <View style={styles.heading}>
            <Text
              style={{
                fontSize: big ? 20 : 16,
                lineHeight: big ? 26 : 22,
                fontWeight: big ? '600' : undefined,
                color: danger ? t.danger : t.text,
              }}
            >
              {title}
            </Text>
            {subtitle && (
              <Text
                style={{
                  fontSize: big ? 14 : 13,
                  lineHeight: big ? 20 : 18,
                  color: t.text2,
                  marginTop: big ? 2 : 1,
                }}
              >
                {subtitle}
              </Text>
            )}
          </View>
        </Pressable>
        {trailing}
        {showSeparator && (
          <View
            pointerEvents='none'
            style={{
              position: 'absolute',
              left: separatorInset ?? 16,
              right: 0,
              top: 0,
              height: StyleSheet.hairlineWidth,
              backgroundColor: t.line,
            }}
          />
        )}
      </View>
    )
  return onPress ? (
    <Pressable
      accessibilityRole='button'
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [rowStyle, pressed && { backgroundColor: t.surface2 }]}
    >
      {content}
    </Pressable>
  ) : (
    <View style={rowStyle}>{content}</View>
  )
}
