import React from 'react'
import { View } from 'react-native'



import { useProductTheme } from '../theme'
import { RowSeparator } from './RowSeparator'
import { styles } from './styles'

function cardChildren (
  children: React.ReactNode,
  prefix = ''
): { child: React.ReactNode, key: string }[] {
  return React.Children.toArray(children).flatMap((child, index) => {
    const key = `${prefix}/${React.isValidElement(child) ? (child.key ?? index) : index}`
    if (React.isValidElement<React.PropsWithChildren>(child) && child.type === React.Fragment)
      return cardChildren(child.props.children, key)
    return [{ child, key }]
  })
}

export function ProductCard ({ children }: React.PropsWithChildren) {
  const t = useProductTheme()
  return (
    <View style={[styles.card, { backgroundColor: t.surface }]}>
      {cardChildren(children).map(({ child, key }, index) => (
        <RowSeparator.Provider key={key} value={index > 0}>
          {child}
        </RowSeparator.Provider>
      ))}
    </View>
  )
}
