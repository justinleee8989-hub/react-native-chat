import React from 'react'
import { PanResponder, Platform, Text, View } from 'react-native'
import {
  getChatPreview,
  useLabels,
  type User,
  type ChatListItem,
} from '@kesha-antonov/react-native-chat'
import { useT } from '../i18n'
import { shortTime } from '../messages/presentation'
import { useProductLayout } from '../ui/preferences'
import { ProductAvatar } from '../ui/primitives'
import { ProductIcon } from '../ui/ProductIcon'
import { ProductPressable as Pressable } from '../ui/ProductPressable'
import { useProductTheme } from '../ui/theme'

export function ProductChatRow ({
  chat,
  last,
  archived,
  selected,
  selecting,
  active,
  onPress,
  onPressIn,
  onMenu,
  onSwipe,
  user,
}: {
  chat: ChatListItem & { avatarID?: string }
  last?: boolean
  archived?: boolean
  user?: User
  selected: boolean
  selecting: boolean
  active: boolean
  onPressIn?: () => void
  onPress: () => void
  onMenu: () => void
  onSwipe?: () => void
}) {
  const tr = useT()
  const t = useProductTheme()
  const { desktop } = useProductLayout()
  const swipe = PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) =>
      !selecting &&
      !!onSwipe &&
      Math.abs(gesture.dx) > 20 &&
      Math.abs(gesture.dx) > Math.abs(gesture.dy) * 2,
    onPanResponderRelease: (_, gesture) => {
      if (gesture.dx < -70)
        onSwipe?.()
    },
  })
  const labels = useLabels()
  const content = getChatPreview(chat, labels, user)
  const date = chat.lastMessage?.createdAt ? new Date(chat.lastMessage.createdAt) : undefined
  const time = date ? shortTime(date.getTime(), tr) : ''
  const web =
    Platform.OS === 'web'
      ? {
        onContextMenu: (event: { preventDefault: () => void }) => {
          event.preventDefault()
          onMenu()
        },
      }
      : {}
  const preview = chat.typingUsers?.length
    ? tr('chats.typing')
    : chat.draft
      ? tr('chats.draft', { text: chat.draft })
      : `${content.prefix || ''}${content.attachment || content.text}`
  return (
    <View {...swipe.panHandlers}>
      <Pressable
        {...web}
        accessibilityRole='button'
        accessibilityLabel={chat.title}
        accessibilityState={{ selected }}
        onPress={onPress}
        onPressIn={onPressIn}
        onLongPress={onMenu}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: 14,
          height: 72,
          paddingHorizontal: desktop ? 14 : 20,
          marginHorizontal: desktop ? 6 : 0,
          borderRadius: desktop ? 12 : 0,
          backgroundColor:
            active || selected
              ? t.accentWeak
              : pressed || (chat.isPinned && !archived)
                ? t.surface2
                : t.page,
        })}
      >
        {selecting && (
          <View
            style={{
              width: 22,
              height: 22,
              borderRadius: 11,
              borderWidth: 1.5,
              borderColor: selected ? t.accent : t.text3,
              backgroundColor: selected ? t.accent : 'transparent',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {selected && <ProductIcon name='check' size={14} color={t.onAccent} />}
          </View>
        )}
        <ProductAvatar
          group={chat.kind === 'group'}
          id={chat.avatarID || chat.id}
          title={chat.title}
          uri={chat.avatar}
          size={52}
        />
        <View
          style={{
            flex: 1,
            gap: 5,
            minWidth: 0,
            alignSelf: 'stretch',
            justifyContent: 'center',
            borderBottomWidth: desktop || last ? 0 : 0.5,
            borderColor: t.line,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text
              numberOfLines={1}
              style={{ flex: 1, color: t.text, fontSize: 16, fontWeight: '600' }}
            >
              {chat.title}
            </Text>
            {chat.isMuted && <ProductIcon name='bellOff' size={14} color={t.text3} />}
            <Text style={{ color: t.text3, fontSize: 12 }}>{time}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text
              numberOfLines={1}
              style={{
                flex: 1,
                color: chat.typingUsers?.length ? t.accent : chat.draft ? t.danger : t.text2,
                fontSize: 14,
              }}
            >
              {preview}
            </Text>
            {!!chat.unreadCount ? (
              <View
                style={{
                  backgroundColor: chat.isMuted ? t.text3 : t.accent,
                  borderRadius: 10,
                  minWidth: 20,
                  paddingHorizontal: 5,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: t.onAccent, fontSize: 12, lineHeight: 20 }}>
                  {chat.unreadCount > 99 ? '99+' : chat.unreadCount}
                </Text>
              </View>
            ) : (
              !archived && chat.isPinned && <ProductIcon name='pin' size={14} color={t.text3} />
            )}
          </View>
        </View>
      </Pressable>
    </View>
  )
}
