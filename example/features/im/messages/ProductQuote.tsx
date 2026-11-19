import React from 'react'
import { Text, View } from 'react-native'
import { type BubbleProps, type IMessage } from '@kesha-antonov/react-native-chat'
import { GestureDetector, useTapGesture } from 'react-native-gesture-handler'
import { useT } from '../i18n'
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
  const tr = useT()
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
        accessibilityLabel={tr('quote.view')}
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
            ? tr('quote.you')
            : replyMessage.user?.name || replyMessage.user?._id || tr('message.unknownSender')}
        </Text>
        <Text
          numberOfLines={1}
          style={{ color, opacity: 0.8, fontSize: 13, lineHeight: 18, maxWidth: 220 }}
        >
          {replyMessage.text ||
            (media.file
              ? tr('preview.file', { name: media.file.name })
              : media.video
                ? tr('preview.video')
                : replyMessage.image
                  ? tr('preview.image')
                  : replyMessage.audio
                    ? tr('preview.voice')
                    : tr('preview.message'))}
        </Text>
      </View>
    </GestureDetector>
  )
}
