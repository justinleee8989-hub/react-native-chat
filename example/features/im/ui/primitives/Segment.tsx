import React from 'react'
import { Text, View } from 'react-native'


import { ProductPressable as Pressable } from '../ProductPressable'
import { useProductTheme } from '../theme'
import { styles } from './styles'

export function ProductSegment ({
  options,
  value,
  onChange,
}: {
  options: { value: string, label: string }[]
  value: string
  onChange: (value: string) => void
}) {
  const t = useProductTheme()
  return (
    <View style={[styles.segment, { backgroundColor: t.surface2 }]}>
      {options.map(option => (
        <Pressable
          key={option.value}
          accessibilityRole='tab'
          accessibilityState={{ selected: value === option.value }}
          onPress={() => onChange(option.value)}
          style={[styles.segmentItem, value === option.value && { backgroundColor: t.surface }]}
        >
          <Text
            style={{
              fontSize: 14,
              fontWeight: '500',
              color: value === option.value ? t.text : t.text2,
            }}
          >
            {option.label}
          </Text>
        </Pressable>
      ))}
    </View>
  )
}
