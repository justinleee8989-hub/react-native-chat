import React from 'react'
import { ActivityIndicator, Pressable, Text, View } from 'react-native'




import { useProductColors as useChatListColors } from '../../ui/theme'
import { styles } from './styles'

export function AuthButton ({
  title,
  onPress,
  disabled,
  busy,
  secondary = false,
}: {
  title: string
  onPress: () => void
  disabled?: boolean
  busy?: boolean
  secondary?: boolean
}) {
  const colors = useChatListColors()
  return (
    <Pressable
      accessibilityRole='button'
      accessibilityState={{ disabled: disabled || busy, busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: secondary ? colors.selectedRow : colors.badge,
          opacity: disabled || busy ? 0.38 : pressed ? 0.9 : 1,
        },
      ]}
    >
      {busy && <ActivityIndicator color={secondary ? colors.attachment : '#fff'} />}
      <Text style={[styles.buttonText, { color: secondary ? colors.attachment : '#fff' }]}>
        {title}
      </Text>
    </Pressable>
  )
}

export function AuthLink ({
  title,
  onPress,
  disabled,
  accessibilityLabel,
}: {
  title: string
  onPress: () => void
  disabled?: boolean
  accessibilityLabel?: string
}) {
  const colors = useChatListColors()
  return (
    <Pressable
      accessibilityRole='button'
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      onPress={onPress}
      style={styles.link}
    >
      <Text
        style={{
          color: colors.attachment,
          fontSize: 14,
          fontWeight: '500',
          opacity: disabled ? 0.38 : 1,
        }}
      >
        {title}
      </Text>
    </Pressable>
  )
}

export function AuthNotice ({
  children,
  error = false,
}: React.PropsWithChildren<{ error?: boolean }>) {
  const colors = useChatListColors()
  return (
    <Text
      accessibilityRole={error ? 'alert' : undefined}
      accessibilityLiveRegion='polite'
      style={[styles.notice, { color: error ? colors.draft : colors.attachment }]}
    >
      {children}
    </Text>
  )
}

export function AuthLinks ({ children }: React.PropsWithChildren) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 4,
      }}
    >
      {children}
    </View>
  )
}
