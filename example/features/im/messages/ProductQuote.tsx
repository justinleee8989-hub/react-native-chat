import React from 'react'
import { Text, View } from 'react-native'
import { type BubbleProps, type IMessage } from '@kesha-antonov/react-native-chat'
import { GestureDetector, useTapGesture } from 'react-native-gesture-handler'
import { useSentPartColor } from '../ui/ProductChatTheme'
import { useProductTheme } from '../ui/theme'

type QuoteRenderer = NonNullable<
  NonNullable<BubbleProps<IMessage>['messageReply']>['renderMessageReply']
>
export function ProductQuote ({
  replyMessage,
  currentMessage,
  position,
  onPress,
  selfID,
}: Parameters<QuoteRenderer>[0] & { selfID?: string | number }) {
  const t = useProductTheme()
  const sent = useSentPartColor()
  const media = replyMessage as Partial<IMessage>
  const color = position === 'right' ? sent : t.text
  const open = () => onPress?.(replyMessage, currentMessage)
  const gesture = useTapGesture({
    runOnJS: true,
    cancelsTouchesInView: false,
    onDeactivate: event => {
      if (!event.canceled)
        open()
    },
  })
  return (
    <GestureDetector gesture={gesture}>
      <View
        accessible
        accessibilityRole='button'
        accessibilityLabel='查看引用消息'
        onAccessibilityTap={open}
        style={{
          marginTop: 7,
          marginHorizontal: 10,
          marginBottom: 0,
          paddingVertical: 5,
          paddingHorizontal: 10,
          borderRadius: 10,
          backgroundColor: position === 'right' ? '#ffffff2e' : '#78788024',
        }}
      >
        <Text numberOfLines={1} style={{ color, fontSize: 13, lineHeight: 18, fontWeight: '600' }}>
          {selfID !== undefined && String(selfID) === String(replyMessage.user?._id)
            ? '你'
            : replyMessage.user?.name || replyMessage.user?._id || '未知联系人'}
        </Text>
        <Text
          numberOfLines={1}
          style={{ color, opacity: 0.8, fontSize: 13, lineHeight: 18, maxWidth: 220 }}
        >
          {replyMessage.text ||
            (media.file
              ? `[文件] ${media.file.name}`
              : media.video
                ? '[视频]'
                : replyMessage.image
                  ? '[图片]'
                  : replyMessage.audio
                    ? '[语音]'
                    : '[消息]')}
        </Text>
      </View>
    </GestureDetector>
  )
}
