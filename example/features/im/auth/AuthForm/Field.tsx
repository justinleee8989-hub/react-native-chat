import React, { useState } from 'react'
import { Platform, Pressable, Text, TextInput, View, type TextStyle, type TextInputProps } from 'react-native'




import { useT } from '../../i18n'
import { ProductIcon } from '../../ui/ProductIcon'
import { useProductColors as useChatListColors, useProductTheme } from '../../ui/theme'
import { styles } from './styles'

export function AuthField ({
  label,
  password = false,
  trailing,
  showLabel = false,
  reveal = false,
  compact = false,
  invalid = false,
  onRevealChange,
  ...props
}: TextInputProps & {
  label: string
  password?: boolean
  showLabel?: boolean
  reveal?: boolean
  compact?: boolean
  /** What was entered was refused: edged in red, except while it has the focus. */
  invalid?: boolean
  onRevealChange?: (visible: boolean) => void
  trailing?: React.ReactNode
  /** Reaches the input, so a page can focus it (React 19 passes `ref` as a prop). */
  ref?: React.Ref<React.ComponentRef<typeof TextInput>>
}) {
  const tr = useT()
  const colors = useChatListColors()
  const [visible, setVisible] = useState(false)
  const [focused, setFocused] = useState(false)
  const t = useProductTheme()
  return (
    <View style={styles.field}>
      {showLabel && <Text style={[styles.label, { color: colors.message }]}>{label}</Text>}

      <View
        style={[
          styles.inputRow,
          {
            minHeight: compact ? 46 : 54,
            borderColor: focused ? t.accent : invalid ? t.danger : 'transparent',
            // Focused, it lifts off the grey onto the page with a soft ring around it.
            backgroundColor: focused ? t.page : colors.pressed,
            boxShadow: focused ? `0 0 0 4px ${t.accentWeak}` : undefined,
          },
        ]}
      >
        <TextInput
          accessibilityLabel={label}
          placeholderTextColor={t.text3}
          autoCapitalize='none'
          autoCorrect={false}
          {...props}
          onFocus={event => {
            setFocused(true)
            props.onFocus?.(event)
          }}
          onBlur={event => {
            setFocused(false)
            props.onBlur?.(event)
          }}
          secureTextEntry={password && !visible}
          style={[
            Platform.OS === 'web' ? ({ outlineStyle: 'none' } as unknown as TextStyle) : undefined,
            styles.input,
            { color: colors.name, fontSize: compact ? 14 : 16, paddingVertical: compact ? 12 : 16 },
          ]}
        />
        {password && reveal && (
          <Pressable
            accessibilityRole='button'
            accessibilityLabel={visible ? tr('auth.hideField', { label }) : tr('auth.showField', { label })}
            onPress={() => {
              setVisible(!visible)
              onRevealChange?.(!visible)
            }}
            style={styles.reveal}
          >
            <ProductIcon name={visible ? 'eyeOff' : 'eye'} size={20} color={t.text3} />
          </Pressable>
        )}
        {trailing && <View style={{ marginRight: 16 }}>{trailing}</View>}
      </View>
    </View>
  )
}
