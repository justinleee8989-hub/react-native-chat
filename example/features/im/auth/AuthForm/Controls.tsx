import React from 'react'
import { ActivityIndicator, Pressable, Text, View } from 'react-native'




import { useProductColors as useChatListColors, useProductTheme } from '../../ui/theme'
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
  trailing = false,
}: {
  title: string
  onPress: () => void
  disabled?: boolean
  accessibilityLabel?: string
  /** Set off at the end of the field above it (忘记密码？ under the password). */
  trailing?: boolean
}) {
  const colors = useChatListColors()
  return (
    <Pressable
      accessibilityRole='button'
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      onPress={onPress}
      style={[styles.link, trailing && styles.linkTrailing]}
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

/** A question with the link that answers it, on one centred line: 还没有账户？注册新账户. */
export function AuthPrompt ({ text, children }: React.PropsWithChildren<{ text: string }>) {
  const t = useProductTheme()
  return (
    <View style={styles.prompt}>
      <Text style={[styles.promptText, { color: t.text2 }]}>{text}</Text>
      {children}
    </View>
  )
}

/** A line under the fields; an error sits on a pale red card with a mark, so it is not missed. */
export function AuthNotice ({
  children,
  error = false,
}: React.PropsWithChildren<{ error?: boolean }>) {
  const colors = useChatListColors()
  const t = useProductTheme()
  const text = (
    <Text
      accessibilityRole={error ? 'alert' : undefined}
      accessibilityLiveRegion='polite'
      style={[styles.notice, error && styles.noticeText, { color: error ? colors.draft : colors.attachment }]}
    >
      {children}
    </Text>
  )
  if (!error)
    return text
  return (
    <View style={[styles.errorCard, { backgroundColor: t.dangerWeak }]}>
      {/* Only a mark: a screen reader says the text alone. */}
      <View
        accessibilityElementsHidden
        importantForAccessibility='no-hide-descendants'
        style={[styles.errorMark, { backgroundColor: t.danger }]}
      >
        <Text style={[styles.errorMarkText, { color: t.onAccent }]}>!</Text>
      </View>
      {text}
    </View>
  )
}
