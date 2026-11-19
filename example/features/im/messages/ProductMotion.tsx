import React, { useEffect, useState } from 'react'
import { Animated, Platform, View } from 'react-native'
import { useT } from '../i18n'
import { useProductLayout } from '../ui/preferences'
import { ProductAvatar } from '../ui/primitives'
import { useProductTheme } from '../ui/theme'

// The web has no native animation driver: asking for it only logs a warning on every run.
const nativeDriver = Platform.OS !== 'web'

export function ProductPulse ({
  color,
  active = true,
  index = 0,
  wave = false,
  size = 7,
}: {
  color: string
  active?: boolean
  index?: number
  wave?: boolean
  size?: number
}) {
  const [value] = useState(() => new Animated.Value(0))
  useEffect(() => {
    value.setValue(0)
    if (!active)
      return
    const animation = Animated.sequence([
      Animated.delay(index * (wave ? 40 : 150)),
      Animated.loop(
        Animated.sequence([
          Animated.timing(value, { toValue: 1, duration: wave ? 700 : 300, useNativeDriver: nativeDriver }),
          Animated.timing(value, { toValue: 0, duration: wave ? 700 : 300, useNativeDriver: nativeDriver }),
          ...(wave ? [] : [Animated.delay(400)]),
        ])
      ),
    ])
    animation.start()
    return () => animation.stop()
  }, [active, index, value, wave])
  return (
    <Animated.View
      style={{
        backgroundColor: color,
        width: wave ? 2.5 : size,
        height: wave ? 5 + ((index * 7 + 3) % 14) : size,
        borderRadius: wave ? 2 : size / 2,
        opacity: wave ? 0.55 : value.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }),
        transform: wave
          ? [{ scaleY: value.interpolate({ inputRange: [0, 1], outputRange: [1, 0.35] }) }]
          : [{ translateY: value.interpolate({ inputRange: [0, 1], outputRange: [0, -3] }) }],
      }}
    />
  )
}

export function ProductTyping ({
  group,
  user,
}: {
  group: boolean
  user?: { _id: string | number, name?: string, avatar?: string }
}) {
  const tr = useT()
  const t = useProductTheme()
  const { desktop } = useProductLayout()
  if (!user)
    return null
  return (
    <View
      accessibilityLabel={group ? tr('typing.someone', { name: user.name || user._id }) : tr('typing.peer')}
      style={{
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 8,
        marginTop: 10,
        paddingHorizontal: desktop ? 28 : 12,
        paddingBottom: 12,
      }}
    >
      {group && (
        <ProductAvatar
          id={String(user._id)}
          title={user.name || String(user._id)}
          uri={user.avatar}
          size={30}
        />
      )}
      <View
        style={{
          flexDirection: 'row',
          gap: 4,
          paddingVertical: 14,
          paddingHorizontal: 16,
          borderRadius: 20,
          borderBottomLeftRadius: 6,
          backgroundColor: t.bubble,
        }}
      >
        {[0, 1, 2].map(index => (
          <ProductPulse key={index} index={index} color={t.text3} />
        ))}
      </View>
    </View>
  )
}
