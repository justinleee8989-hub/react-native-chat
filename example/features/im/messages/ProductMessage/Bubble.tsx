import React, { useContext } from 'react'
import { Text, View } from 'react-native'
import { Bubble, type BubbleProps, type IMessage } from '@kesha-antonov/react-native-chat'
import { useProductLayout } from '../../ui/preferences'
import { useChatThemeLook } from '../../ui/ProductChatTheme'
import { useProductTheme } from '../../ui/theme'
import { ProductAudio } from '../ProductAudio'
import { ProductContextMenu } from '../ProductContextMenu'
import { ProductFile } from '../ProductFile'
import { ProductMessageImage, ProductMessageText, ProductReactions } from '../ProductMessageParts'
import { ProductQuote } from '../ProductQuote'
import { MessageWidth } from './context'

const noMeta = () => null
export function ProductBubble (props: BubbleProps<IMessage>) {
  const width = useContext(MessageWidth)
  const t = useProductTheme()
  const { desktop } = useProductLayout()
  const previous = props.previousMessage
  const first =
    !previous?.user ||
    previous.system ||
    previous.user._id !== props.currentMessage.user._id ||
    new Date(props.currentMessage.createdAt).getTime() - new Date(previous.createdAt).getTime() >
      5 * 60 * 1000
  const showName = props.isUsernameVisible && props.position === 'left' && first
  const next = props.nextMessage
  const last =
    !next?.user ||
    next.user._id !== props.currentMessage.user._id ||
    new Date(next.createdAt).getTime() - new Date(props.currentMessage.createdAt).getTime() >
      5 * 60 * 1000
  // 我的 → 外观 → 聊天主题 sets the radius and the sharper corner a group ends on.
  const { radius, corner } = useChatThemeLook().preset
  const corners = {
    borderRadius: radius,
    borderTopLeftRadius: radius,
    borderTopRightRadius: radius,
    borderBottomLeftRadius: last && props.position === 'left' ? corner : radius,
    borderBottomRightRadius: last && props.position === 'right' ? corner : radius,
    maxWidth: width ? width * (desktop ? 0.62 : 0.76) : undefined,
  }
  return (
    <View style={{ flex: 1 }}>
      {showName && (
        <Text
          numberOfLines={1}
          style={{ color: t.text2, fontSize: 12, marginLeft: 12, marginBottom: 3 }}
        >
          {props.currentMessage.user.name || props.currentMessage.user._id}
        </Text>
      )}
      <Bubble
        {...props}
        isContextMenuEnabled
        isUsernameVisible={false}
        renderMessageAudio={part => <ProductAudio {...part} />}
        renderMessageFile={part => <ProductFile {...part} />}
        renderMessageText={part => <ProductMessageText {...part} />}
        renderMessageImage={part => <ProductMessageImage {...part} />}
        bottomContainerStyle={{ left: { display: 'none' }, right: { display: 'none' } }}
        messageReply={{
          ...props.messageReply,
          renderMessageReply: quote => <ProductQuote {...quote} selfID={props.user?._id} />,
        }}
        reactions={
          props.currentMessage.sent
            ? {
              ...props.reactions,
              renderReactions: reactionProps => <ProductReactions {...reactionProps} />,
            }
            : { ...props.reactions, isEnabled: false }
        }
        renderContextMenu={part => <ProductContextMenu {...part} />}
        wrapperStyle={{
          left: { ...props.wrapperStyle?.left, ...corners },
          right: { ...props.wrapperStyle?.right, ...corners },
        }}
        renderTime={noMeta}
        renderTicks={noMeta}
      />
    </View>
  )
}
