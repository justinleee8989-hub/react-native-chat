import React, { useState } from 'react'
import { Pressable, type PressableProps } from 'react-native'
import { useProductLayout } from './preferences'

/** Desktop hover shares the prototype's pressed surface; touch keeps native feedback. */
export function ProductPressable ({
  style,
  onHoverIn,
  onHoverOut,
  disabled,
  ...props
}: PressableProps) {
  const { desktop } = useProductLayout()
  const [hovered, setHovered] = useState(false)
  return (
    <Pressable
      {...props}
      disabled={disabled}
      onHoverIn={event => {
        setHovered(true)
        onHoverIn?.(event)
      }}
      onHoverOut={event => {
        setHovered(false)
        onHoverOut?.(event)
      }}
      style={
        typeof style === 'function'
          ? state =>
            style({ ...state, pressed: state.pressed || (desktop && hovered && !disabled) })
          : style
      }
    />
  )
}
