import React from 'react'
import { Platform, TextInput, type TextStyle, type TextInputProps } from 'react-native'
import { useProductTheme } from '../ui/theme'

export function ProductPromptField (props: TextInputProps) {
  const t = useProductTheme()
  return (
    <TextInput
      autoFocus
      accessibilityLabel={props.placeholder}
      placeholderTextColor={t.text3}
      {...props}
      style={{
        ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as unknown as TextStyle) : {}),
        width: '100%',
        height: props.multiline ? 96 : 44,
        borderRadius: 12,
        marginTop: 8,
        paddingHorizontal: 12,
        paddingVertical: props.multiline ? 10 : 12,
        fontSize: 16,
        lineHeight: props.multiline ? 22 : undefined,
        color: t.text,
        backgroundColor: t.surface2,
        textAlignVertical: props.multiline ? 'top' : 'center',
      }}
    />
  )
}
