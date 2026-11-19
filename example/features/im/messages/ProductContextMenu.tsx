import React from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import type { ContextMenuProps } from '@kesha-antonov/react-native-chat'
import { useT } from '../i18n'
import { useProductLayout } from '../ui/preferences'
import { ProductIcon } from '../ui/ProductIcon'
import { ProductModal, useProductOverlayBounds } from '../ui/ProductModal'
import { ProductPressable as Pressable } from '../ui/ProductPressable'
import { useProductTheme } from '../ui/theme'

const icons = {
  reply: 'reply',
  copy: 'copy',
  forward: 'forward',
  edit: 'edit',
  readers: 'eye',
  revoke: 'undo',
  retry: 'retry',
} as const
export function ProductContextMenu (props: ContextMenuProps) {
  const tr = useT()
  const t = useProductTheme()
  const { desktop } = useProductLayout()
  const bounds = useProductOverlayBounds()
  if (!props.visible)
    return null
  const width = Math.min(desktop ? 228 : 214, bounds.width - 16)
  const contentHeight = props.items.length * 46 + (props.reactions ? 56 : 0)
  const height = Math.min(contentHeight, bounds.height - 24)
  const x = (props.pageX || 0) - bounds.x
  const y = (props.pageY || 0) - bounds.y
  const bottom = y + (props.bubbleHeight || 0)
  const top = Math.max(
    8,
    Math.min(
      bounds.height - height - 12,
      bounds.height - bottom > height + 20 ? bottom + 8 : y - height - 8
    )
  )
  const left = Math.max(
    8,
    Math.min(
      bounds.width - width - 8,
      props.position === 'right' ? x + (props.bubbleWidth || 0) - width : x
    )
  )
  return (
    <ProductModal onRequestClose={props.onDismiss}>
      <View style={{ flex: 1, backgroundColor: t.scrim }}>
        <Pressable
          accessibilityRole='button'
          accessibilityLabel={tr('message.closeMenu')}
          onPress={props.onDismiss}
          style={StyleSheet.absoluteFill}
        />
        <ScrollView
          style={{
            position: 'absolute',
            left,
            top,
            width,
            maxHeight: height,
            overflow: contentHeight > height ? 'hidden' : 'visible',
          }}
          scrollEnabled={contentHeight > height}
          keyboardShouldPersistTaps='handled'
        >
          {props.reactions && (
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                paddingVertical: 6,
                paddingHorizontal: 8,
                marginBottom: 8,
                borderRadius: 24,
                backgroundColor: t.surface,
                boxShadow: t.shadow,
              }}
            >
              {props.reactions.emojis.slice(0, 6).map(emoji => (
                <Pressable
                  key={emoji}
                  accessibilityRole='button'
                  accessibilityLabel={emoji}
                  onPress={() => {
                    props.onDismiss()
                    props.reactions?.onSelect(emoji)
                  }}
                  style={{
                    width: 34,
                    flexShrink: 1,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: props.reactions?.selected?.includes(emoji)
                      ? t.accentWeak
                      : undefined,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ fontSize: 22 }}>{emoji}</Text>
                </Pressable>
              ))}
            </View>
          )}
          <View
            style={{
              borderRadius: 16,
              overflow: 'hidden',
              backgroundColor: t.surface,
              boxShadow: t.shadow,
            }}
          >
            {props.items.map((item, index) => (
              <Pressable
                key={item.key || item.label}
                accessibilityRole='button'
                onPress={() => {
                  props.onDismiss()
                  item.onPress()
                }}
                style={({ pressed }) => ({
                  height: 46,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingHorizontal: 16,
                  borderTopWidth: index ? 0.5 : 0,
                  borderColor: t.line,
                  backgroundColor: pressed ? t.surface2 : t.surface,
                })}
              >
                <Text style={{ color: item.destructive ? t.danger : t.text, fontSize: 16 }}>
                  {item.label}
                </Text>
                <ProductIcon
                  name={icons[item.key as keyof typeof icons] || 'more'}
                  size={19}
                  color={item.destructive ? t.danger : t.text2}
                />
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </View>
    </ProductModal>
  )
}
