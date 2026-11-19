import React, { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { Message, type MessageProps, type IMessage } from '@kesha-antonov/react-native-chat'
import { useT } from '../../i18n'
import { useRowRenderCount } from '../../navigation/entry-performance'
import { useProductLayout } from '../../ui/preferences'
import { ProductAvatar } from '../../ui/primitives'
import { useChatPill } from '../../ui/ProductChatTheme'
import { ProductIcon } from '../../ui/ProductIcon'
import { useProductTheme } from '../../ui/theme'
import { messageTimestamp } from '../presentation'
import { MessageWidth } from './context'
import type { ProductMessageProps } from './types'

export function ProductMessage ({
  containerWidth,
  lastOwnID,
  group,
  readCount,
  onReaders,
  onRetry,
  ...props
}: ProductMessageProps) {
  const tr = useT()
  useRowRenderCount()
  const t = useProductTheme()
  // Over a wallpaper the date and system notices sit on a pill (外观 → 聊天壁纸).
  const pill = useChatPill()
  const { desktop } = useProductLayout()
  const edge = desktop ? 28 : 12
  const [measuredWidth, setWidth] = useState<number>()
  // The list already measures its viewport before placing rows. Reuse that width so
  // text wraps once instead of every bubble reflowing after its own onLayout.
  const width = containerWidth === undefined ? measuredWidth : containerWidth - edge * 2
  const message = props.currentMessage
  const date = new Date(message.createdAt)
  const previous = props.previousMessage
  const separated =
    !previous?.createdAt || date.getTime() - new Date(previous.createdAt).getTime() > 15 * 60 * 1000
  const first =
    !previous?.user ||
    previous.system ||
    previous.user._id !== message.user._id ||
    date.getTime() - new Date(previous.createdAt).getTime() > 5 * 60 * 1000
  const next = props.nextMessage
  const last =
    !next?.user ||
    next.system ||
    next.user._id !== message.user._id ||
    new Date(next.createdAt).getTime() - date.getTime() > 5 * 60 * 1000
  const status = message.isFailed
    ? tr('message.sendFailed')
    : message.pending
      ? tr('message.sending')
      : message._id === lastOwnID
        ? group
          ? readCount === undefined
            ? tr('message.viewReaders')
            : tr('message.readByCount', { count: readCount })
          : message.received
            ? tr('message.read')
            : tr('message.sent')
        : ''
  return (
    <View
      style={{ paddingHorizontal: edge }}
      onLayout={containerWidth === undefined ? event => setWidth(event.nativeEvent.layout.width - edge * 2) : undefined}
    >
      <MessageWidth.Provider value={width}>
        {separated && (
          <Text
            style={[
              {
                color: t.text3,
                fontSize: 12,
                textAlign: 'center',
                lineHeight: 16,
                marginTop: 14,
                marginBottom: 8,
              },
              pill && { ...pill, alignSelf: 'center', overflow: 'hidden', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 2 },
            ]}
          >
            {messageTimestamp(date, tr)}
          </Text>
        )}
        <View
          style={{
            flexDirection: props.position === 'right' ? 'row-reverse' : 'row',
            alignItems: 'center',
            gap: 8,
          }}
        >
          {group && props.position === 'left' && !message.system && (
            <View style={{ width: 30, alignSelf: 'flex-end' }}>
              {last && (
                <Pressable
                  accessibilityRole='button'
                  accessibilityLabel={tr('message.viewProfileOf', { name: message.user.name || message.user._id })}
                  onPress={() =>
                    (
                      props as MessageProps<IMessage> & {
                        onPressAvatar?: (user: IMessage['user']) => void
                      }
                    ).onPressAvatar?.(message.user)
                  }
                >
                  <ProductAvatar
                    id={message.user._id}
                    title={message.user.name || String(message.user._id)}
                    uri={typeof message.user.avatar === 'string' ? message.user.avatar : undefined}
                    size={30}
                  />
                </Pressable>
              )}
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Message
              {...props}
              isAvatarVisible={false}
              containerStyle={{
                left: {
                  ...props.containerStyle?.left,
                  marginHorizontal: 0,
                  marginBottom: 0,
                  marginTop: first ? 10 : 2,
                },
                right: {
                  ...props.containerStyle?.right,
                  marginHorizontal: 0,
                  marginBottom: 0,
                  marginTop: first ? 10 : 2,
                },
              }}
              renderSystemMessage={({ currentMessage }) => (
                <View
                  style={{
                    alignSelf: 'center',
                    maxWidth: '80%',
                    marginVertical: 8,
                    paddingVertical: 4,
                    paddingHorizontal: 10,
                    borderRadius: 10,
                    backgroundColor: pill?.backgroundColor ?? '#7878801f',
                  }}
                >
                  <Text
                    style={{ color: t.text2, fontSize: 12, lineHeight: 16, textAlign: 'center' }}
                  >
                    {currentMessage.text}
                  </Text>
                </View>
              )}
            />
          </View>
          {message.isFailed && onRetry && (
            <Pressable
              accessibilityRole='button'
              accessibilityLabel={tr('message.retrySend')}
              onPress={() => onRetry(message)}
              style={{
                width: 24,
                height: 24,
                borderRadius: 12,
                backgroundColor: t.danger,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ProductIcon name='warn' size={16} color={t.onAccent} />
            </Pressable>
          )}
        </View>
        {!!status && props.position === 'right' && (
          <Pressable
            disabled={!group || message._id !== lastOwnID}
            accessibilityRole={group ? 'button' : 'text'}
            onPress={() => onReaders(message)}
          >
            <Text
              style={{
                color: message.isFailed ? t.danger : group ? t.accent : t.text3,
                fontSize: 11.5,
                textAlign: 'right',
                marginRight: 6,
                marginTop: 3,
                marginBottom: 0,
              }}
            >
              {status}
            </Text>
          </Pressable>
        )}
      </MessageWidth.Provider>
    </View>
  )
}
