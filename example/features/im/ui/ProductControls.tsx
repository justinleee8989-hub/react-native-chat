import React, { useEffect, useRef } from 'react'
import { ActivityIndicator, Animated, Text, View } from 'react-native'
import { ProductPressable as Pressable } from './ProductPressable'
import { useProductTheme } from './theme'

export function ProductButton ({
  title,
  onPress,
  disabled = false,
  busy = false,
  compact = false,
  variant = 'primary',
}: {
  title: string
  onPress: () => void
  disabled?: boolean
  busy?: boolean
  compact?: boolean
  variant?: 'primary' | 'soft' | 'plain' | 'danger' | 'gray'
}) {
  const t = useProductTheme()
  const blocked = disabled || busy
  const backgroundColor = {
    primary: t.accent,
    soft: t.accentWeak,
    plain: t.surface,
    danger: t.danger,
    gray: t.surface2,
  }[variant]
  const color =
    variant === 'primary' || variant === 'danger'
      ? t.onAccent
      : variant === 'soft'
        ? t.accent
        : t.text
  return (
    <Pressable
      accessibilityRole='button'
      accessibilityLabel={title}
      accessibilityState={{ disabled: blocked, busy }}
      disabled={blocked}
      onPress={onPress}
      style={({ pressed }) => ({
        height: compact ? 34 : 52,
        borderRadius: compact ? 17 : 14,
        paddingHorizontal: compact ? 14 : 16,
        alignSelf: compact ? 'flex-start' : 'stretch',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor,
        opacity: blocked ? 0.38 : pressed ? 0.9 : 1,
      })}
    >
      {busy && <ActivityIndicator size='small' color={color} />}
      <Text style={{ fontSize: compact ? 14 : 16, fontWeight: '600', color }}>{title}</Text>
    </Pressable>
  )
}

export function ProductSwitch ({
  value,
  onValueChange,
  disabled = false,
  accessibilityLabel,
}: {
  value: boolean
  onValueChange: (value: boolean) => void
  disabled?: boolean
  accessibilityLabel: string
}) {
  const t = useProductTheme()
  const position = useRef(new Animated.Value(value ? 20 : 0)).current
  useEffect(() => {
    const animation = Animated.timing(position, {
      toValue: value ? 20 : 0,
      duration: 200,
      useNativeDriver: false,
    })
    animation.start()
    return () => animation.stop()
  }, [position, value])
  return (
    <Pressable
      accessibilityRole='switch'
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value, disabled }}
      // react-native-web reads the aria-* props: through accessibilityState alone a screen reader
      // heard the switch as off while it was on.
      aria-checked={value}
      aria-disabled={disabled}
      disabled={disabled}
      onPress={() => onValueChange(!value)}
      hitSlop={7}
      style={{
        width: 50,
        height: 30,
        borderRadius: 15,
        backgroundColor: value ? t.accent : t.switchTrack,
        opacity: disabled ? 0.38 : 1,
      }}
    >
      <Animated.View
        style={{ position: 'absolute', top: 2, left: 2, transform: [{ translateX: position }] }}
      >
        <View
          style={{
            width: 26,
            height: 26,
            borderRadius: 13,
            backgroundColor: '#FFFFFF',
            boxShadow: '0 1px 4px rgba(0,0,0,.25)',
          }}
        />
      </Animated.View>
    </Pressable>
  )
}
