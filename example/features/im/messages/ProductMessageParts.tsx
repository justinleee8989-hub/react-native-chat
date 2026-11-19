import React, { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import {
  MessageImage,
  MessageText,
  type IMessage,
  type MessageReactionsDisplayProps,
  type RenderMessageImageProps,
  type RenderMessageTextProps,
  type ReplyPreviewProps,
} from '@kesha-antonov/react-native-chat'
import { useT } from '../i18n'
import { useProductLayout } from '../ui/preferences'
import { useSentPartColor } from '../ui/ProductChatTheme'
import { ProductIcon } from '../ui/ProductIcon'
import { useProductTheme } from '../ui/theme'
import { ProductImagePreview } from './ProductImagePreview'

export function ProductMessageText (props: RenderMessageTextProps<IMessage>) {
  const tr = useT()
  const t = useProductTheme()
  const sent = useSentPartColor()
  const color = props.position === 'right' ? sent : t.text
  return (
    <MessageText
      {...props}
      linkStyle={{
        left: { color, textDecorationLine: 'underline' },
        right: { color, textDecorationLine: 'underline' },
      }}
      trailing={
        props.currentMessage.isEdited ? (
          <Text accessibilityLabel={tr('message.edited')} style={{ color, fontSize: 11, opacity: 0.6 }}>
            {tr('message.editedMark')}
          </Text>
        ) : undefined
      }
    />
  )
}

export function ProductMessageImage (props: RenderMessageImageProps<IMessage>) {
  const [preview, setPreview] = useState<string>()
  const { desktop } = useProductLayout()
  const image = props.currentMessage as IMessage & { imageWidth?: number, imageHeight?: number }
  const portrait = (image.imageHeight || 0) > (image.imageWidth || Infinity)
  const next = props.nextMessage
  const last =
    !next?.user ||
    next.system ||
    next.user._id !== props.currentMessage.user._id ||
    new Date(next.createdAt).getTime() - new Date(props.currentMessage.createdAt).getTime() >
      5 * 60 * 1000
  return (
    <>
      <MessageImage
        {...props}
        onPressImage={message => setPreview(message.image)}
        containerStyle={{
          overflow: 'hidden',
          borderRadius: 20,
          borderBottomLeftRadius: last && props.position === 'left' ? 6 : 20,
          borderBottomRightRadius: last && props.position === 'right' ? 6 : 20,
        }}
        imageStyle={{
          minWidth: 0,
          width: portrait ? (desktop ? 220 : 170) : desktop ? 280 : 210,
          height: portrait ? (desktop ? 290 : 220) : desktop ? 200 : 150,
          maxWidth: '100%',
          borderRadius: 0,
        }}
      />
      {preview && <ProductImagePreview uri={preview} onClose={() => setPreview(undefined)} />}
    </>
  )
}

export function ProductReactions ({
  reactions,
  currentUserId,
  onReactionPress,
  position,
}: MessageReactionsDisplayProps<IMessage>) {
  const t = useProductTheme()
  return (
    <View
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 4,
        marginTop: 3,
        marginHorizontal: 4,
        marginBottom: 2,
        alignSelf: position === 'right' ? 'flex-end' : 'flex-start',
      }}
    >
      {reactions
        .filter(reaction => reaction.userIds.length)
        .map(reaction => {
          const selected = currentUserId !== undefined && reaction.userIds.includes(currentUserId)
          return (
            <Pressable
              key={reaction.emoji}
              accessibilityRole='button'
              accessibilityLabel={`${reaction.emoji} ${reaction.userIds.length}`}
              accessibilityState={{ selected }}
              onPress={() => onReactionPress?.(reaction.emoji)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                height: 26,
                paddingHorizontal: 8,
                borderRadius: 13,
                backgroundColor: selected ? t.accentWeak : t.surface,
                borderWidth: selected ? 0 : 0.5,
                borderColor: t.line,
              }}
            >
              <Text style={{ fontSize: 13 }}>{reaction.emoji}</Text>
              <Text style={{ fontSize: 13, color: selected ? t.accent : t.text2 }}>
                {reaction.userIds.length}
              </Text>
            </Pressable>
          )
        })}
    </View>
  )
}

export function ProductReplyPreview ({
  replyMessage,
  mode,
  selfID,
  onClearReply,
}: ReplyPreviewProps & { selfID?: string }) {
  const tr = useT()
  const t = useProductTheme()
  const { desktop } = useProductLayout()
  const media = replyMessage as Partial<IMessage>
  const title =
    mode === 'edit'
      ? tr('composer.editing')
      : tr('composer.replyTo', { name: String(replyMessage.user._id) === selfID ? tr('composer.yourself') : replyMessage.user.name || replyMessage.user._id })
  const summary =
    replyMessage.text ||
    (media.file
      ? tr('preview.file', { name: media.file.name })
      : media.video
        ? tr('preview.video')
        : media.image
          ? tr('preview.image')
          : media.audio
            ? tr('preview.voice')
            : tr('preview.message'))
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingTop: 8,
        paddingLeft: desktop ? 20 : 16,
        paddingRight: desktop ? 20 : 8,
        width: '100%',
        maxWidth: 920,
        alignSelf: 'center',
      }}
    >
      <View
        style={{ width: 3, alignSelf: 'stretch', borderRadius: 2, backgroundColor: t.accent }}
      />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          numberOfLines={1}
          style={{ color: t.accent, fontSize: 13, lineHeight: 18, fontWeight: '600' }}
        >
          {title}
        </Text>
        <Text numberOfLines={1} style={{ color: t.text2, fontSize: 13, lineHeight: 18 }}>
          {summary}
        </Text>
      </View>
      <Pressable
        accessibilityRole='button'
        accessibilityLabel={tr('common.cancel')}
        onPress={onClearReply}
        style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}
      >
        <ProductIcon name='close' size={20} color={t.text2} />
      </Pressable>
    </View>
  )
}
