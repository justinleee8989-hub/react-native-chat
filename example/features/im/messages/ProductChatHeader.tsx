import React from 'react'
import { Pressable, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { Conversation } from '../domain/types'
import { useDesktopNavigation } from '../navigation/DesktopNavigation'
import { useProductLayout } from '../ui/preferences'
import { ProductAvatar } from '../ui/primitives'
import { ProductIconButton } from '../ui/ProductPage'
import { useProductTheme } from '../ui/theme'

export function ProductChatHeader ({
  conversation,
  typing,
  memberCount,
  onCall,
  onMore,
}: {
  conversation: Conversation
  typing: string
  memberCount?: number
  onCall: () => void
  onMore: () => void
}) {
  const router = useRouter()
  const t = useProductTheme()
  const navigation = useDesktopNavigation()
  const { desktop } = useProductLayout()
  const insets = useSafeAreaInsets()
  const info = () =>
    router.push(`/chats/conversation/${encodeURIComponent(conversation.conversationID)}`)
  return (
    <View
      style={{
        backgroundColor: t.bg,
        paddingTop: desktop ? 0 : insets.top,
        borderBottomWidth: 0.5,
        borderColor: t.line,
      }}
    >
      <View
        style={{
          height: desktop ? 60 : 52,
          flexDirection: 'row',
          alignItems: 'center',
          paddingLeft: desktop ? 16 : 6,
          paddingRight: desktop ? 12 : 6,
        }}
      >
        {(!desktop || navigation?.canGoBackInSection) && (
          <ProductIconButton
            name='back'
            label='返回'
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/chats'))}
          />
        )}
        {desktop && (
          <Pressable
            accessibilityRole='button'
            accessibilityLabel='聊天信息'
            onPress={info}
            style={{ marginLeft: 4 }}
          >
            <ProductAvatar
              group={!!conversation.groupID}
              id={conversation.groupID || conversation.userID || conversation.conversationID}
              title={conversation.showName}
              uri={conversation.faceURL}
              size={38}
            />
          </Pressable>
        )}
        <Pressable
          onPress={info}
          accessibilityRole='button'
          accessibilityLabel='聊天信息'
          style={{
            flex: 1,
            minWidth: 0,
            paddingLeft: desktop ? 8 : 44,
            paddingRight: desktop ? 8 : 0,
          }}
        >
          <Text
            numberOfLines={1}
            style={{
              color: t.text,
              fontWeight: '600',
              fontSize: 17,
              textAlign: desktop ? 'left' : 'center',
            }}
          >
            {conversation.showName}
          </Text>
          <Text
            style={{
              color: typing ? t.accent : t.text3,
              fontSize: 12,
              textAlign: desktop ? 'left' : 'center',
            }}
          >
            {typing ||
              (conversation.groupID
                ? memberCount === undefined
                  ? '群聊'
                  : `${memberCount} 位成员`
                : '私人会话')}
          </Text>
        </Pressable>
        <ProductIconButton name='phone' label='音视频通话' onPress={onCall} />
        <ProductIconButton name='more' label='聊天信息' onPress={onMore} />
      </View>
    </View>
  )
}
