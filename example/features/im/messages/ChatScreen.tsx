import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Button, StyleSheet, Text, View } from 'react-native'
import { Chat, IMessage, ReplyMessage } from '@kesha-antonov/react-native-chat'
import { useFocusEffect, useNavigation, useRouter } from 'expo-router'
import {
  focusConversation,
  resumeConversation,
  sendQuote,
  revokeMessage,
  loadHistory,
  reportError,
  retryMessage,
  sendMedia,
  sendLocation,
  sendCard,
  sendAttachmentBatchChecked,
  runAttachmentBatch,
  cancelAttachmentBatch,
  sendTextChecked,
  sendPreparedChecked,
  syncMessageReaders,
  useOpenIM,
} from '@/features/im/application/store'
import LoginScreen from '@/features/im/auth/LoginScreen'
import { toMessage } from '@/features/im/domain/model'
import type { IMMessage } from '@/features/im/domain/types'
import { Confirm } from '@/features/im/shared/shared'
import { useTask } from '@/features/im/shared/useTask'
import { subscribeForeground } from '../application/foreground'
import { startConversationCall } from '../calls/CallControls'
import { parseCallInvitation } from '../calls/invitation'
import { messageCallSignal, projectCallMessages } from '../calls/message-projection'
import { traceChatEntryOnce, traceChatRender } from '../navigation/entry-performance'
import { type NavigationWithTransitions, onOpeningTransition } from '../navigation/opening-transition'
import { useChatEntryReady } from '../navigation/useChatEntry'
import { ConnectionStatus } from '../shared/ConnectionStatus'
import { useProductLayout, useProductScheme } from '../ui/preferences'
import { productChatLabels } from '../ui/ProductChatLabels'
import { useProductChatTheme, productChatIcons } from '../ui/ProductChatTheme'
import { AttachmentBatchTray } from './AttachmentBatchTray'
import { useComposerEnhancements } from './ComposerEnhancements'
import ForwardPicker from './ForwardPicker'
import { HistoryLoadIndicator } from './HistoryLoadIndicator'
import { MentionPicker } from './MentionPicker'
import { groupReadCount } from './presentation'
import { ProductChatHeader } from './ProductChatHeader'
import { ProductComposerMenu } from './ProductComposerMenu'
import { ProductInputToolbar } from './ProductInputToolbar'

const reportVoiceRecordingError = (error: unknown) => {
  const code = (error as { code?: string } | null)?.code
  if (code === 'VOICE_RECORDER_START_TIMEOUT') {
    reportError(new Error('麦克风启动超时，请检查浏览器和系统的麦克风权限'))
    return
  }
  if (code === 'VOICE_RECORDER_STOP_TIMEOUT') {
    reportError(new Error('录音结束超时，请重新录制'))
    return
  }
  reportError(error)
}
import { MessageCustomContent } from './MessageCustomContent'
import { ProductMessage, ProductBubble } from './ProductMessage'
import { ProductTyping } from './ProductMotion'
import { useAttachmentBatches } from './useAttachmentBatches'
import { useConversationAccess } from './useConversationAccess'
import { useLatestGroupReaders } from './useLatestGroupReaders'
import { useMessageExtras } from './useMessageExtras'
import { useMessageListLayout } from './useMessageListLayout'
import { useMessageLocation } from './useMessageLocation'

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
  const state = useOpenIM()
  const entryAccount = `${state.session?.userID}:${state.session?.imToken}`
  // Diagnostics only (EXPO_PUBLIC_OPENIM_ENTRY_TRACE): one line per commit of this page.
  useLayoutEffect(() => {
    traceChatRender(entryAccount, id)
  })
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
  const latestOwnGroupMessage =
    conversation?.groupID && sessionID
      ? rawMessages.find(
        message =>
          message.sendID === sessionID &&
            message.groupID === conversation.groupID &&
            message.status === 2 &&
            message.contentType < 1000 &&
            (message.seq || 0) > 0
      )
      : undefined
  useLatestGroupReaders({
    session: state.session,
    chatURL: state.config.chat,
    conversationID: id,
    message: latestOwnGroupMessage,
    readInfo: latestOwnGroupMessage
      ? state.messageReadInfo[id]?.[latestOwnGroupMessage.clientMsgID]
      : undefined,
    enabled: !!conversation?.groupID,
    refreshToken: readerRefreshToken,
    sync: syncMessageReaders,
  })
  // Move the status slot when the optimistic row appears, not again on its acknowledgement.
  const lastOwnMessageID = rawMessages.find(
    message => message.sendID === sessionID &&
      (message.status === 1 || message.status === 2) && message.contentType < 1000
  )?.clientMsgID
  const extras = useMessageExtras(id, rawMessages)
  // Kept across renders that leave the messages and their extras alone: this page re-renders on
  // every change anywhere in the IM store, and rebuilding every message each time made the list
  // compare every row again while the page was being prepared.
  const extrasMap = extras.map
  const messages = useMemo(
    () => projectCallMessages(rawMessages, messageID ? [messageID] : []).map(message => {
      const mapped = extrasMap(toMessage(message))
      if (
        (message.contentType === 108 && !!message.cardElem?.userID) ||
        (message.contentType === 109 &&
          message.locationElem &&
          Number.isFinite(message.locationElem.latitude) &&
          Math.abs(message.locationElem.latitude) <= 90 &&
          Number.isFinite(message.locationElem.longitude) &&
          Math.abs(message.locationElem.longitude) <= 180)
      )
        return { ...mapped, text: '' }
      return messageCallSignal(message) || parseCallInvitation(message.textElem?.content || '')
        ? { ...mapped, text: '' }
        : mapped
    }),
    [rawMessages, messageID, extrasMap]
  )
  // The push that opens this page: traced, and the list grows its off-screen buffer once it ends.
  const navigation = useNavigation() as unknown as NavigationWithTransitions
  const onListTransitionEnd = messageListLayout.onTransitionEnd
  useEffect(() => {
    const offStart = onOpeningTransition(navigation, 'transitionStart', () => traceChatEntryOnce(entryAccount, id, 'transition-start'))
    const offEnd = onOpeningTransition(navigation, 'transitionEnd', () => {
      traceChatEntryOnce(entryAccount, id, 'transition-end')
      onListTransitionEnd()
    })
    return () => {
      offStart()
      offEnd()
    }
  }, [navigation, entryAccount, id, onListTransitionEnd])
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
  const conversationID = conversation?.conversationID
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
  useFocusEffect(
    useCallback(() => {
      if (!sessionID || !conversationID || !state.session)
        return
      const stopConversation = focusConversation(id)
      const unsubscribeForeground = subscribeForeground(() => {
        setReaderRefreshToken(value => value + 1)
        void resumeConversation(id, state.session!).catch(reportError)
      })
      return () => {
        unsubscribeForeground()
        stopConversation()
      }
    }, [id, sessionID, conversationID, state.session])
  )
  const onSend = useCallback(
    (messages: IMessage[]) => {
      if (access.notice || access.error) {
        reportError(access.error || access.notice)
        return
      }
      messages.forEach(message => {
        if (message.audio)
          void sendMedia(
            id,
            {
              type: 'audio',
              uri: message.audio,
              duration: message.duration,
            },
            message.replyMessage ? String(message.replyMessage._id) : undefined
          ).catch(reportError)
        else if (message.replyMessage)
          void composer
            .sendWithDraft(() => sendQuote(id, message.text, String(message.replyMessage!._id)))
            .catch(error => {
              setReply(message.replyMessage || null)
              reportError(error)
            })
        else
          void composer
            .sendWithDraft(async () => {
              const selected = composer.selectedMentions.filter(member =>
                message.text.includes(`@${member.nickname}`)
              )
              if (selected.length) {
                const created = await composer.buildAtMessage(message.text, selected)
                await sendPreparedChecked(id, created)
              } else {
                await sendTextChecked(id, message.text)
              }
            })
            .catch(reportError)
      })
    },
    [id, composer, access.notice, access.error]
  )
  const requestCall = () => {
    void task.run(async () => {
      if (access.notice || access.error)
        throw new Error(access.error || access.notice)
      if (!conversation)
        throw new Error('会话不可用，请返回列表重试')
      await startConversationCall(conversation, id)
    })
  }
  if (!state.session)
    return <LoginScreen />
  if (!conversation)
    return (
      <View style={styles.container}>
        <Button
          title='返回会话列表'
          onPress={() => {
            if (router.canGoBack())
              router.back()
            else
              router.replace('/(tabs)/chats')
          }}
        />
        <Text>正在同步会话；若刷新后仍不存在，请返回列表重新打开。</Text>
      </View>
    )
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
              ? `${composer.typingUsers[0].name} 正在输入…`
              : '对方正在输入…'
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
          title='撤回这条消息？'
          confirmLabel='撤回'
          danger
          message='是否允许撤回由服务器的时限和权限规则决定。'
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
      {!!access.error && (
        <View>
          <Text accessibilityRole='alert' style={styles.error}>
            {access.error}
          </Text>
          <Button
            title='重试同步会话权限'
            onPress={() => {
              void access.refresh()
            }}
          />
        </View>
      )}
      {!!task.error && (
        <Text accessibilityRole='alert' style={styles.error}>
          {task.error}
        </Text>
      )}
      {!!composer.draftError && (
        <View>
          <Text accessibilityRole='alert' style={styles.error}>
            草稿恢复失败，当前输入已保留
          </Text>
          <Button title='重试恢复草稿' onPress={composer.retryDraft} />
        </View>
      )}
      {!!state.error && (
        <Text accessibilityRole='alert' style={styles.error}>
          {state.error}
        </Text>
      )}
      {locating && <Text accessibilityRole='text'>正在定位消息…</Text>}
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
        icons={productChatIcons}
        labels={productChatLabels}
        renderChatEmpty={() => null}
        renderDay={() => null}
        renderBubble={props => <ProductBubble {...props} />}
        renderMessage={props => (
          <ProductMessage
            {...props}
            containerWidth={messageListLayout.width}
            onRetry={message => {
              const raw = rawMessages.find(item => item.clientMsgID === message._id)
              if (raw)
                void retryMessage(id, raw).catch(reportError)
            }}
            readCount={groupReadCount(
              rawMessages.find(raw => raw.clientMsgID === props.currentMessage._id),
              state.messageReadInfo[id]?.[String(props.currentMessage._id)]?.readCount
            )}
            lastOwnID={lastOwnMessageID}
            group={!!conversation.groupID}
            onReaders={message =>
              router.push({
                pathname: '/chats/readers/[id]',
                params: {
                  id,
                  messageID: String(message._id),
                  seq: String(rawMessages.find(raw => raw.clientMsgID === message._id)?.seq || 0),
                },
              })
            }
          />
        )}
        renderInputToolbar={props =>
          access.notice && access.notice !== '正在同步会话权限…' ? (
            <View style={{ minHeight: 56, padding: 12, justifyContent: 'center' }}>
              <Text style={{ textAlign: 'center', color: theme.colors.dayPillText, fontSize: 14 }}>
                {access.notice}
              </Text>
            </View>
          ) : (
            <ProductInputToolbar {...props} selfID={sessionID} accessPending={access.notice === '正在同步会话权限…'} />
          )
        }
        renderLoadEarlier={props => <HistoryLoadIndicator {...props} paging={!!state.historyPaging?.[id]} />}
        loadEarlierMessagesProps={{
          isAvailable: rawMessages.length > 0 && !state.historyEnd[id],
          isLoading: !!state.historyLoading?.[id],
          isInfiniteScrollEnabled: true,
          onPress: () => {
            void loadHistory(id, true).catch(reportError)
          },
          label: '加载更早消息',
          containerStyle: { marginTop: 6, marginBottom: 10 },
          wrapperStyle: {
            backgroundColor: theme.colors.surface,
            height: 30,
            paddingHorizontal: 14,
            paddingVertical: 0,
            borderRadius: 15,
          },
          textStyle: { color: theme.colors.incomingMeta, fontSize: 13, marginTop: 0 },
        }}
        onPressAvatar={user => router.push(`/chats/people/${encodeURIComponent(user._id)}`)}
        messagesContainerRef={messageListLayout.messagesContainerRef}
        listProps={{
          onLayout: event => {
            traceChatEntryOnce(entryAccount, id, 'list-layout')
            messageListLayout.onLayout(event)
          },
          onReady: onListReady,
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
        locale='zh-CN'
        text={composer.text}
        onDraftChange={value => {
          const newlyTypedAt = value !== composer.text && /(^|\s)@$/.test(value)
          composer.onDraftChange(value)
          if (conversation.groupID && newlyTypedAt)
            setMentionOpen(true)
        }}
        textInputProps={{
          numberOfLines: 1,
          placeholder: '消息',
          onFocus: composer.onFocus,
          onBlur: composer.onBlur,
        }}
        isTyping={composer.typingUsers.length > 0}
        renderTypingIndicator={() => (
          <ProductTyping group={!!conversation.groupID} user={composer.typingUsers[0]} />
        )}
        messages={messages}
        renderCustomView={({ currentMessage }) => (
          <MessageCustomContent
            self={state.session?.userID || ''}
            message={rawMessages.find(message => message.clientMsgID === currentMessage?._id)}
            onCall={requestCall}
            onError={reportError}
          />
        )}
        onSend={onSend}
        onEditMessage={extras.edit}
        reactions={{
          isEnabled: true,
          emojis: ['👍', '❤️', '😂', '😮', '😢', '🙏'],
          onReactionPress: extras.react,
          renderExpandedPicker: null,
        }}
        user={{ _id: state.session.userID }}
        isGroupChat={!!conversation.groupID}
        reply={{
          onPress: source => requestLocation(String(source._id)),
          message: reply,
          onReply: setReply,
          onClear: () => setReply(null),
        }}
        attachments={{
          tabs: ['gallery', 'camera', 'file'],
          renderAttachmentMenu: props => (
            <ProductComposerMenu
              {...props}
              onMention={conversation.groupID ? () => setMentionOpen(true) : undefined}
              onLocation={async location => {
                const sendingReply = activeReply.current
                await sendLocation(
                  id,
                  location,
                  sendingReply ? String(sendingReply._id) : undefined
                )
                setReply(current => (current === sendingReply ? null : current))
              }}
              onCard={async card => {
                const sendingReply = activeReply.current
                await sendCard(id, card, sendingReply ? String(sendingReply._id) : undefined)
                setReply(current => (current === sendingReply ? null : current))
              }}
            />
          ),
          isGalleryGridEnabled: false,
          onPick: async (attachments, { caption }) => {
            try {
              const sendingReply = activeReply.current
              const sourceID = sendingReply ? String(sendingReply._id) : undefined
              if (batchSession.current !== state.session)
                throw new Error('登录已改变，请重新发送附件')
              await sendAttachmentBatchChecked(
                id,
                attachments
                  .filter(attachment => attachment.type !== 'location')
                  .map(attachment => ({
                    ...attachment,
                    name: attachment.type === 'file' ? attachment.name : attachment.fileName,
                  })),
                caption,
                sourceID
              )
              setReply(current => (current === sendingReply ? null : current))
            } catch (error) {
              reportError(error)
            }
            return null
          },
        }}
        audioRecording={{
          isViewOnceEnabled: false,
          onError: reportVoiceRecordingError,
          onTooShort: () => reportError(new Error('录音时间太短，请重试')),
          onPermissionDenied: () => reportError(new Error('请在系统设置中允许麦克风访问')),
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
        messageActions={(message, defaults) => {
          const raw = rawMessages.find(item => item.clientMsgID === message._id)
          if (!raw || raw.contentType >= 1000)
            return []
          const actions = defaults.filter(
            action =>
              ['copy', 'retry'].includes(action.key || '') ||
              (raw.status === 2 && ['reply', 'forward'].includes(action.key || '')) ||
              (raw.status === 2 &&
                raw.contentType === 101 &&
                raw.sendID === state.session?.userID &&
                !parseCallInvitation(raw.textElem?.content || '') &&
                !messageCallSignal(raw) &&
                action.key === 'edit')
          )
          if (raw.sendID === state.session?.userID && raw.status === 2)
            actions.push({
              key: 'revoke',
              label: '撤回',
              destructive: true,
              onPress: () => setRevoke(raw.clientMsgID),
            })
          if (
            raw.groupID &&
            raw.sendID === state.session?.userID &&
            raw.status === 2 &&
            (raw.seq || 0) > 0
          )
            actions.push({
              key: 'readers',
              label: '已读成员',
              onPress: () =>
                router.push({
                  pathname: '/chats/readers/[id]',
                  params: { id, messageID: raw.clientMsgID, seq: String(raw.seq) },
                }),
            })
          const order = ['retry', 'reply', 'copy', 'forward', 'edit', 'readers', 'revoke']
          return actions.sort((a, b) => order.indexOf(a.key || '') - order.indexOf(b.key || ''))
        }}
      />
    </View>
  )
}
const styles = StyleSheet.create({
  container: { flex: 1 },
  error: { color: '#b42318', padding: 8 },
})
