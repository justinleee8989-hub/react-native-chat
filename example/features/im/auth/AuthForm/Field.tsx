import React, { useState } from 'react'
import { Platform, Pressable, Text, TextInput, View, type TextStyle, type TextInputProps } from 'react-native'




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
  ...props
}: TextInputProps & {
  label: string
  password?: boolean
  showLabel?: boolean
  reveal?: boolean
  compact?: boolean
  trailing?: React.ReactNode
}) {
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
            borderColor: focused ? t.accent : 'transparent',
            backgroundColor: colors.pressed,
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
            accessibilityLabel={visible ? `隐藏${label}` : `显示${label}`}
            onPress={() => setVisible(!visible)}
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
