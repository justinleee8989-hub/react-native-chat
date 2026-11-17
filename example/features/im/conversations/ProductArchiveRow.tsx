import React from 'react'
import { Text, View } from 'react-native'
import { type ChatListItem } from '@kesha-antonov/react-native-chat'
import { useProductLayout } from '../ui/preferences'
import { ProductIcon } from '../ui/ProductIcon'
import { ProductPressable } from '../ui/ProductPressable'
import { useProductTheme } from '../ui/theme'

export function ProductArchiveRow ({
  chats,
  onPress,
  active = false,
}: {
  chats: ChatListItem[]
  onPress: () => void
  active?: boolean
}) {
  const t = useProductTheme()
  const { desktop } = useProductLayout()
  return (
    <ProductPressable
      accessibilityRole='button'
      accessibilityLabel={`已归档会话 ${chats.length}`}
      onPress={onPress}
      style={{
        backgroundColor: active ? t.surface2 : undefined,
        minHeight: 64,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        paddingHorizontal: desktop ? 14 : 20,
        marginHorizontal: desktop ? 6 : 0,
        borderRadius: desktop ? 10 : 0,
      }}
    >
      <View
        style={{
          width: 52,
          height: 52,
          borderRadius: 26,
          backgroundColor: t.surface2,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ProductIcon name='archive' color={t.text} />
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text
            numberOfLines={1}
            style={{ flex: 1, color: t.text, fontSize: 16, fontWeight: '600' }}
          >
            已归档会话
          </Text>
          <Text style={{ fontSize: 12, color: t.text3 }}>{chats.length}</Text>
        </View>
        <Text numberOfLines={1} style={{ fontSize: 14, color: t.text2 }}>
          {chats.map(chat => chat.title).join('、')}
        </Text>
      </View>
    </ProductPressable>
  )
}
