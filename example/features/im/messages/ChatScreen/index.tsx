import React, { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { View } from 'react-native'
import { Chat, ReplyMessage } from '@kesha-antonov/react-native-chat'
import { useRouter } from 'expo-router'
import {
  cancelAttachmentBatch,
  reportError,
  retryMessage,
  revokeMessage,
  runAttachmentBatch,
  useOpenIM,
} from '../../application/store'
import LoginScreen from '../../auth/LoginScreen'
import { startConversationCall } from '../../calls/CallControls'
import type { IMMessage } from '../../domain/types'
import { useT } from '../../i18n'
import { traceChatEntryOnce } from '../../navigation/entry-performance'
import { useChatEntryReady } from '../../navigation/useChatEntry'
import { ConnectionStatus } from '../../shared/ConnectionStatus'
import { errorMessage } from '../../shared/error-message'
import { ProductError } from '../../shared/product-error'
import { ProductToast, showProductToast } from '../../shared/ProductToast'
import { Confirm } from '../../shared/shared'
import { useInFront } from '../../shared/useInFront'
import { useTask } from '../../shared/useTask'
import { usePhotoWallpaperRender } from '../../ui/ChatWallpaperView'
import { useProductLayout, useProductScheme } from '../../ui/preferences'
import { productChatLabels } from '../../ui/ProductChatLabels'
import { productChatIcons, useProductChatTheme } from '../../ui/ProductChatTheme'
import { AttachmentBatchTray } from '../AttachmentBatchTray'
import { useComposerEnhancements } from '../ComposerEnhancements'
import ForwardPicker from '../ForwardPicker'
import { MentionPicker } from '../MentionPicker'
import { ProductChatHeader } from '../ProductChatHeader'
import { ProductTyping } from '../ProductMotion'
import { useAttachmentBatches } from '../useAttachmentBatches'
import { useChatRows } from '../useChatRows'
import { useConversationAccess } from '../useConversationAccess'
import { useMessageExtras } from '../useMessageExtras'
import { useMessageListLayout } from '../useMessageListLayout'
import { useMessageLocation } from '../useMessageLocation'
import { chatAttachments } from './attachments'
import { ChatNotices } from './ChatNotices'
import { chatHistoryProps } from './history'
import { renderChatInputToolbar } from './inputToolbar'
import { MissingConversation } from './MissingConversation'
import { styles } from './styles'
import { useChatSend } from './useChatSend'
import { useFocusedConversation } from './useFocusedConversation'
import { useGroupReadCount } from './useGroupReadCount'
import { useOpeningTransition } from './useOpeningTransition'
import { reportVoiceRecordingError } from './voice-errors'

export default function ChatScreen ({ id, messageID }: { id: string, messageID?: string }) {
  const { session } = useOpenIM()
  if (!session)
    return <LoginScreen />
  return (
    <SessionChat key={`${session.userID}:${session.imToken}:${id}`} id={id} messageID={messageID} />
  )
}

const EMPTY_MESSAGES: IMMessage[] = []

function SessionChat ({ id, messageID }: { id: string, messageID?: string }) {
  const tr = useT()
  const state = useOpenIM()
  const entryAccount = `${state.session?.userID}:${state.session?.imToken}`
  const { chatRef, locating, requestLocation } = useMessageLocation(id, messageID)
  const messageListLayout = useMessageListLayout()

  const router = useRouter()
  const [forward, setForward] = useState<IMMessage>()
  const [reply, setReply] = useState<ReplyMessage | null>(null)
  const [revoke, setRevoke] = useState<string>()
  const [readerRefreshToken, setReaderRefreshToken] = useState(0)
  const task = useTask()
  const theme = useProductChatTheme()
  const scheme = useProductScheme()
  const { desktop } = useProductLayout()
  const background = theme.colors.background
  const renderWallpaper = usePhotoWallpaperRender()
  const conversation = state.conversations.find(item => item.conversationID === id)
  const sessionID = state.session?.userID
  const access = useConversationAccess(conversation, state.session?.userID || '')
  const batches = useAttachmentBatches().filter(batch => batch.conversationID === id)
  const rawMessages = state.messages[id] || EMPTY_MESSAGES
  const onEntryReady = useChatEntryReady(
    entryAccount,
    id,
    rawMessages.length > 0 || state.historyEnd[id] !== undefined
  )
  const onLayoutReady = messageListLayout.onReady
  const onListReady = useCallback(() => {
    onEntryReady()
    onLayoutReady()
  }, [onEntryReady, onLayoutReady])
  useGroupReadCount({
    id,
    conversation,
    session: state.session,
    chatURL: state.config.chat,
    rawMessages,
    readInfo: state.messageReadInfo[id],
    refreshToken: readerRefreshToken + (state.readersChanged?.[id] || 0),
  })
  // Move the status slot when the optimistic row appears, not again on its acknowledgement.
  const lastOwnMessageID = rawMessages.find(
    message => message.sendID === sessionID &&
      (message.status === 1 || message.status === 2) && message.contentType < 1000
  )?.clientMsgID
  const extras = useMessageExtras(id, rawMessages)
  useOpeningTransition(entryAccount, id, messageListLayout.onTransitionEnd)
  const composer = useComposerEnhancements({
    userID: state.session?.userID || '',
    conversation: conversation || {
      conversationID: id,
      conversationType: 1,
      showName: '',
      unreadCount: 0,
    },
  })
  const [mentionOpen, setMentionOpen] = useState(false)
  const activeReply = useRef(reply)
  useLayoutEffect(() => {
    activeReply.current = reply
  }, [reply])
  const batchSession = useRef(state.session)
  useLayoutEffect(() => {
    batchSession.current = state.session
    return () => {
      batchSession.current = undefined
    }
  }, [state.session])
  const askReadersAgain = useCallback(() => setReaderRefreshToken(value => value + 1), [])
  useFocusedConversation({ id, session: state.session, available: !!conversation, onForeground: askReadersAgain })
  // A page opened over this chat shows its own toasts.
  const front = useInFront()
  const onSend = useChatSend({ id, composer, accessNotice: access.notice, accessError: access.error, setReply })
  // One call at a time (a second tap while it starts is ignored). One that cannot start is said in a
  // passing toast: a notice pinned above the chat would stay there long after the user moved on.
  const requestCall = () => {
    void task.run(async () => {
      try {
        if (access.notice || access.error)
          throw access.error || new ProductError(access.notice || 'error.generic')
        if (!conversation)
          throw new ProductError('chat.unavailable')
        await startConversationCall(conversation, id)
      } catch (error) {
        showProductToast(errorMessage(error, tr))
      }
    })
  }

  // Everything the message rows render with, kept still across this page's frequent re-renders.
  const rows = useChatRows({
    id,
    messageID,
    rawMessages,
    extras,
    readInfo: state.messageReadInfo[id],
    selfID: state.session?.userID || '',
    isGroup: !!conversation?.groupID,
    rowWidth: messageListLayout.width,
    lastOwnMessageID,
    requestCall,
    onRevoke: setRevoke,
  })

  if (!state.session)
    return <LoginScreen />
  if (!conversation)
    return <MissingConversation />
  return (
    <View
      style={[styles.container, { backgroundColor: background }]}
      onLayout={() => traceChatEntryOnce(entryAccount, id, 'page-layout')}
    >
      <ProductChatHeader
        conversation={conversation}
        memberCount={access.count}
        typing={
          composer.typingUsers.length
            ? conversation.groupID
              ? tr('typing.someoneDots', { name: composer.typingUsers[0].name })
              : tr('typing.peerDots')
            : ''
        }
        onCall={requestCall}
        onMore={() => router.push(`/chats/conversation/${encodeURIComponent(id)}`)}
      />
      {!!conversation.groupID && mentionOpen && (
        <MentionPicker
          groupID={conversation.groupID}
          onClose={() => setMentionOpen(false)}
          onSelect={member => {
            composer.selectMention(member)
            composer.onDraftChange(`${composer.text.replace(/@$/, '')}@${member.nickname} `)
          }}
        />
      )}
      {forward && <ForwardPicker message={forward} onClose={() => setForward(undefined)} />}
      {revoke && (
        <Confirm
          error={task.error}
          title={tr('revoke.confirmTitle')}
          confirmLabel={tr('message.revoke')}
          danger
          message={tr('revoke.hint')}
          busy={task.busy}
          onCancel={() => setRevoke(undefined)}
          onConfirm={() => {
            void task.run(async () => {
              await revokeMessage(id, revoke)
              if (batchSession.current === state.session)
                setRevoke(undefined)
            })
          }}
        />
      )}
      <ConnectionStatus status={state.status} />
      <ChatNotices
        accessError={errorMessage(access.error, tr)}
        onRetryAccess={() => {
          void access.refresh()
        }}
        taskError={task.error}
        draftError={!!composer.draftError}
        onRetryDraft={composer.retryDraft}
        storeError={errorMessage(state.error, tr)}
        locating={locating}
      />
      <AttachmentBatchTray
        batches={batches}
        onRetry={batchID => runAttachmentBatch(batchID).catch(reportError)}
        onCancel={cancelAttachmentBatch}
      />
      <Chat
        deferMessageListMount={false}
        messagesContainerStyle={
          desktop ? { maxWidth: 920, width: '100%', alignSelf: 'center' } : undefined
        }
        colorScheme={scheme}
        theme={theme}
        darkTheme={theme}
        renderWallpaper={renderWallpaper}
        icons={productChatIcons}
        labels={productChatLabels(tr)}
        renderChatEmpty={rows.renderChatEmpty}
        renderDay={rows.renderDay}
        renderBubble={rows.renderBubble}
        renderMessage={rows.renderMessage}
        renderInputToolbar={renderChatInputToolbar({ accessNotice: access.notice, selfID: sessionID, theme, tr })}
        {...chatHistoryProps({
          tr,
          id,
          available: rawMessages.length > 0 && !state.historyEnd[id],
          loading: !!state.historyLoading?.[id],
          paging: !!state.historyPaging?.[id],
          theme,
        })}
        onPressAvatar={user => router.push(`/chats/people/${encodeURIComponent(user._id)}`)}
        messagesContainerRef={messageListLayout.messagesContainerRef}
        listProps={{
          onLayout: event => {
            traceChatEntryOnce(entryAccount, id, 'list-layout')
            messageListLayout.onLayout(event)
          },
          onReady: onListReady,
          onScrollBeginDrag: messageListLayout.onScrollBeginDrag,
          drawDistance: messageListLayout.drawDistance,
          // History prepends and measured row corrections must preserve the visible anchor
          // immediately; animating their positions creates gaps during native flings.
          itemLayoutAnimation: undefined,
          onStartReachedThreshold: 1,
          showsVerticalScrollIndicator: false,
          contentContainerStyle: { paddingTop: desktop ? 16 : 8, paddingBottom: desktop ? 18 : 12 },
        }}
        chatRef={chatRef}
        mediaPlayback={{ isNowPlayingBarEnabled: false, isAutoPlayNextEnabled: false }}
        locale={tr.locale}
        text={composer.text}
        onDraftChange={value => {
          const newlyTypedAt = value !== composer.text && /(^|\s)@$/.test(value)
          composer.onDraftChange(value)
          if (conversation.groupID && newlyTypedAt)
            setMentionOpen(true)
        }}
        textInputProps={{
          numberOfLines: 1,
          placeholder: tr('composer.placeholder'),
          onFocus: composer.onFocus,
          onBlur: composer.onBlur,
        }}
        isTyping={composer.typingUsers.length > 0}
        renderTypingIndicator={() => (
          <ProductTyping group={!!conversation.groupID} user={composer.typingUsers[0]} />
        )}
        messages={rows.messages}
        renderCustomView={rows.renderCustomView}
        onSend={onSend}
        onEditMessage={extras.edit}
        reactions={rows.reactions}
        user={{ _id: state.session.userID }}
        isGroupChat={!!conversation.groupID}
        reply={{
          onPress: source => requestLocation(String(source._id)),
          message: reply,
          onReply: setReply,
          onClear: () => setReply(null),
        }}
        attachments={chatAttachments({
          id,
          group: !!conversation.groupID,
          activeReply,
          batchSession,
          session: state.session,
          setReply,
          onMention: () => setMentionOpen(true),
        })}
        audioRecording={{
          isViewOnceEnabled: false,
          onError: reportVoiceRecordingError,
          onTooShort: () => reportError(new ProductError('recording.tooShort')),
          onPermissionDenied: () => reportError(new ProductError('recording.allowMic')),
        }}
        videoRecording={false}
        onForwardMessage={message =>
          setForward(rawMessages.find(item => item.clientMsgID === message._id))
        }
        onRetryMessage={message => {
          const raw = rawMessages.find(item => item.clientMsgID === message._id)
          if (raw)
            void retryMessage(id, raw).catch(reportError)
        }}
        messageActions={rows.messageActions}
      />
      {/* Last, so it draws over the chat. Only while in front, as the chat list does. */}
      {front && <ProductToast />}
    </View>
  )
}
