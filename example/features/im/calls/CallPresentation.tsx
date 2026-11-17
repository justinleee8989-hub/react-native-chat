import React from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg'
import { useProductLayout } from '../ui/preferences'
import { ProductAvatar } from '../ui/primitives'
import { ProductIcon } from '../ui/ProductIcon'
import { useProductOverlayBounds } from '../ui/ProductModal'

export function callConnectionLabel (state: string): string {
  switch (state) {
    case 'connected':
      return '已连接'
    case 'connecting':
      return '正在连接…'
    case 'reconnecting':
    case 'signalReconnecting':
      return '正在重连'
    case 'disconnected':
      return '连接已断开'
    default:
      return '准备连接'
  }
}

export function CallControl ({
  label,
  icon,
  active,
  tone,
  disabled,
  onPress,
}: {
  label: string
  icon: React.ComponentProps<typeof ProductIcon>['name']
  active?: boolean
  tone?: 'red' | 'green'
  disabled?: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      accessibilityRole='button'
      accessibilityLabel={label}
      accessibilityState={{ disabled, selected: active }}
      disabled={disabled}
      onPress={onPress}
      style={{ alignItems: 'center', gap: 8, opacity: disabled ? 0.4 : 1 }}
    >
      <View
        style={{
          width: tone ? 72 : 62,
          height: tone ? 72 : 62,
          borderRadius: tone ? 36 : 31,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor:
            tone === 'red'
              ? '#F04452'
              : tone === 'green'
                ? '#2FB67C'
                : active
                  ? '#fff'
                  : 'rgba(255,255,255,.14)',
          transform: tone === 'red' ? [{ rotate: '135deg' }] : undefined,
        }}
      >
        <ProductIcon name={icon} size={tone ? 30 : 26} color={active && !tone ? '#111' : '#fff'} />
      </View>
      <Text style={{ color: 'rgba(255,255,255,.72)', fontSize: 12 }}>{label}</Text>
    </Pressable>
  )
}
export function CallPresentation ({
  name,
  id,
  uri,
  group = false,
  status,
  error,
  children,
  media,
}: React.PropsWithChildren<{
  name: string
  id: string
  uri?: string
  group?: boolean
  status: string
  error?: string
  media?: React.ReactNode
}>) {
  const { desktop } = useProductLayout()
  const { height } = useProductOverlayBounds()
  const insets = useSafeAreaInsets()
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'transparent',
        padding: desktop ? 24 : 0,
      }}
    >
      <View
        testID='call-presentation'
        style={{
          width: desktop ? 360 : '100%',
          height: desktop ? Math.min(620, height - 48) : '100%',
          maxWidth: '100%',
          borderRadius: desktop ? 28 : 0,
          overflow: 'hidden',
          backgroundColor: '#0a0a0d',
          boxShadow: desktop ? '0 30px 80px rgba(0,0,0,.5)' : undefined,
        }}
      >
        <Svg pointerEvents='none' width='100%' height='100%' style={StyleSheet.absoluteFill}>
          <Defs>
            <RadialGradient
              id='callGradient'
              cx={0}
              cy={0}
              r={1}
              gradientUnits='objectBoundingBox'
              gradientTransform='matrix(1.2 0 0 0.8 0.5 0)'
            >
              <Stop offset='0%' stopColor='#2b3350' />
              <Stop offset='60%' stopColor='#12141c' />
              <Stop offset='100%' stopColor='#0a0a0d' />
            </RadialGradient>
          </Defs>
          <Rect width='100%' height='100%' fill='url(#callGradient)' />
        </Svg>
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            alignItems: 'center',
            paddingTop: desktop ? 64 : insets.top + 72,
            paddingHorizontal: 24,
            paddingBottom: desktop ? 48 : insets.bottom + 48,
          }}
        >
          <View style={{ width: 112, height: 112 }}>
            <View
              pointerEvents='none'
              style={{
                position: 'absolute',
                inset: -14,
                borderRadius: group ? 47.6 : 70,
                borderWidth: 8,
                borderColor: 'rgba(255,255,255,.04)',
              }}
            />
            <View
              pointerEvents='none'
              style={{
                position: 'absolute',
                inset: -6,
                borderRadius: group ? 39.6 : 62,
                borderWidth: 6,
                borderColor: 'rgba(255,255,255,.08)',
              }}
            />
            <ProductAvatar group={group} id={id} title={name} uri={uri} size={112} />
          </View>
          <Text
            numberOfLines={2}
            style={{
              color: '#fff',
              fontSize: 28,
              lineHeight: 34,
              fontWeight: '700',
              marginTop: 26,
              textAlign: 'center',
            }}
          >
            {name}
          </Text>
          <Text
            style={{
              color: 'rgba(255,255,255,.66)',
              fontSize: 16,
              fontVariant: ['tabular-nums'],
              marginTop: 8,
              textAlign: 'center',
            }}
          >
            {status}
          </Text>
          {!!error && (
            <Text
              accessibilityRole='alert'
              style={{ color: '#ff9ca5', marginTop: 12, textAlign: 'center' }}
            >
              {error}
            </Text>
          )}
          {media}
          <View style={{ flex: 1, minHeight: 24 }} />
          {children}
        </ScrollView>
      </View>
    </View>
  )
}
