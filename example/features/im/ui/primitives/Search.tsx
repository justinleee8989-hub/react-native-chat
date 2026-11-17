import React from 'react'
import { Platform, TextInput, View, type TextStyle, type TextInputProps } from 'react-native'
import { useProductLayout } from '../preferences'
import { ProductIcon } from '../ProductIcon'
import { useProductTheme } from '../theme'
import { styles } from './styles'

export function ProductSearch ({ side = false, ...props }: TextInputProps & { side?: boolean }) {
  const { desktop } = useProductLayout()
  const t = useProductTheme()
  return (
    <View
      style={[
        styles.search,
        { backgroundColor: t.surface2, marginHorizontal: side && desktop ? 14 : 16 },
      ]}
    >
      <ProductIcon name='search' size={20} color={t.text3} />
      <TextInput
        accessibilityLabel={props.placeholder || '搜索'}
        placeholderTextColor={t.text3}
        {...props}
        style={[
          Platform.OS === 'web' ? ({ outlineStyle: 'none' } as unknown as TextStyle) : undefined,
          styles.searchInput,
          { color: t.text },
          props.style,
        ]}
      />
    </View>
  )
}
