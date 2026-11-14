import React, { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { Button, Pressable, StyleSheet, Text, View } from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import {
  Chat,
  ChatListAvatar,
  defaultDarkTheme,
  defaultLightTheme,
  IMessage,
  ReplyMessage,
} from '@kesha-antonov/react-native-chat'
import { useFocusEffect, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  focusConversation,
  sendQuote,
  revokeMessage,
  loadHistory,
  reportError,
  retryMessage,
  sendMedia,
  sendAttachmentBatchChecked,
  runAttachmentBatch,
  cancelAttachmentBatch,
  sendTextChecked,
  sendPreparedChecked,
  useOpenIM,
} from '@/features/im/application/store'
import LoginScreen from '@/features/im/auth/LoginScreen'
import { toMessage } from '@/features/im/domain/model'
import type { IMMessage } from '@/features/im/domain/types'
import { Confirm } from '@/features/im/shared/shared'
import { useTask } from '@/features/im/shared/useTask'
import { useColorScheme } from '@/hooks/use-color-scheme'
import { useChatListColors } from '../../../components/chat-list/theme'
import { StartCall, JoinCall } from '../calls/CallControls'
import { parseCallInvitation } from '../calls/invitation'
import { AttachmentBatchTray } from './AttachmentBatchTray'
import { assertMediaReplyAllowed } from './composer'
import { MentionPicker, useComposerEnhancements } from './ComposerEnhancements'
import ForwardPicker from './ForwardPicker'
import { useAttachmentBatches } from './useAttachmentBatches'
import { useMessageExtras } from './useMessageExtras'
import { useMessageLocation } from './useMessageLocation'

export default function ChatScreen ({ id, messageID }: { id: string, messageID?: string }) {
  const { session } = useOpenIM()
  if (!session)
    return <LoginScreen />
  return <SessionChat key={`${session.userID}:${session.imToken}:${id}`} id={id} messageID={messageID} />
}

function SessionChat ({ id, messageID }: { id: string, messageID?: string }) {
  const state = useOpenIM()
  const { chatRef, locating } = useMessageLocation(id, messageID)

  const router = useRouter()
  const [forward, setForward] = useState<IMMessage>()
  const [reply, setReply] = useState<ReplyMessage | null>(null)
  const [revoke, setRevoke] = useState<string>()
  const task = useTask()
  const colors = useChatListColors()
  const insets = useSafeAreaInsets()
  const theme = useColorScheme() === 'dark' ? defaultDarkTheme : defaultLightTheme
  const background = theme.colors.background
  const conversation = state.conversations.find(item => item.conversationID === id)
  const batches = useAttachmentBatches().filter(batch => batch.conversationID === id)
  const rawMessages = state.messages[id] || []
  const extras = useMessageExtras(id, rawMessages)
  const composer = useComposerEnhancements({ userID: state.session?.userID || '', conversation: conversation || { conversationID: id, conversationType: 1, showName: '', unreadCount: 0 } })
  const [mentionOpen, setMentionOpen] = useState(false)
  const conversationID = conversation?.conversationID
  const sessionID = state.session?.userID
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
      if (sessionID && conversationID)
        return focusConversation(id)
    }, [id, sessionID, conversationID])
  )
  const onSend = useCallback(
    (messages: IMessage[]) => {
      messages.forEach(message => {
        if (message.audio && message.replyMessage) {
          setReply(message.replyMessage)
          reportError(new Error('引用回复仅支持文字，请先取消引用，再发送语音'))
          return
        }
        if (message.audio)
          void sendMedia(id, {
            type: 'audio',
            uri: message.audio,
            duration: message.duration,
          }).catch(reportError)
        else if (message.replyMessage)
          void composer.sendWithDraft(() => sendQuote(id, message.text, String(message.replyMessage!._id))).catch(error => {
            setReply(message.replyMessage || null)
            reportError(error)
          })
        else
          void composer.sendWithDraft(async () => {
            const selected = composer.selectedMentions.filter(member => message.text.includes(`@${member.nickname}`))
            if (selected.length) {
              const created = await composer.buildAtMessage(message.text, selected)
              await sendPreparedChecked(id, created)
            } else {
              await sendTextChecked(id, message.text)
            }
          }).catch(reportError)
      })
    },
    [id, composer]
  )
  if (!state.session)
    return <LoginScreen />
  if (!conversation)
    return (
      <View style={styles.container}>
        <Button title='返回会话列表' onPress={() => router.back()} />
        <Text>正在同步会话；若刷新后仍不存在，请返回列表重新打开。</Text>
      </View>
    )
  const failed = rawMessages.filter(message => message.status === 3)
  return (
    <View style={[styles.container, { backgroundColor: background }]}>
      <View
        style={[
          styles.header,
          { paddingTop: insets.top, backgroundColor: colors.headerBackground },
        ]}
      >
        <View style={styles.headerBar}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={4}
            style={styles.headerButton}
            accessibilityRole='button'
            accessibilityLabel='返回'
          >
            <MaterialCommunityIcons name='arrow-left' size={24} color={colors.headerIcon} />
          </Pressable>
          <ChatListAvatar
            id={id}
            title={conversation.showName}
            uri={conversation.faceURL}
            size={42}
            ringColor={colors.headerBackground}
          />
          <Pressable style={styles.headerText}
            accessibilityRole='button'
            accessibilityLabel={conversation.groupID ? '查看群资料' : '查看联系人资料'}
            disabled={!conversation.groupID && !conversation.userID}
            onPress={() => {
              if (conversation.groupID)
                router.push(`/chats/groups/${encodeURIComponent(conversation.groupID)}`)
              else if (conversation.userID)
                router.push(`/chats/people/${encodeURIComponent(conversation.userID)}`)
            }}
          >
            <Text style={[styles.headerTitle, { color: colors.headerTitle }]} numberOfLines={1}>
              {conversation.showName}
            </Text>
            <Text style={{ color: colors.subtitle }}>{composer.typingUsers.length ? '对方正在输入…' : state.status}</Text>
          </Pressable>
          <Pressable
            accessibilityRole='button'
            accessibilityLabel='会话设置'
            style={styles.headerButton}
            onPress={() => router.push(`/chats/conversation/${id}`)}
          >
            <MaterialCommunityIcons name='cog-outline' size={24} color={colors.headerIcon} />
          </Pressable>
          {!!conversation.groupID && (
            <Pressable
              accessibilityRole='button'
              accessibilityLabel='群详情'
              style={styles.headerButton}
              onPress={() => router.push(`/chats/groups/${conversation.groupID}`)}
            >
              <MaterialCommunityIcons name='account-group' size={24} color={colors.headerIcon} />
            </Pressable>
          )}
        </View>
      </View>
      <StartCall conversationID={id} />
      {!!conversation.groupID && <>
        <Button title='@ 提醒群成员' onPress={() => setMentionOpen(true)} />
        {mentionOpen && <MentionPicker visible theme={theme} groupID={conversation.groupID} onClose={() => setMentionOpen(false)} onSelect={member => {
          composer.selectMention(member)
          composer.onDraftChange(`${composer.text}@${member.nickname} `)
        }}
        />}
      </>}
      <Button title='搜索聊天记录' onPress={() => router.push(`/chats/search/${id}`)} />
      {forward && <ForwardPicker message={forward} onClose={() => setForward(undefined)} />}
      {revoke && <Confirm message='撤回这条消息？是否允许撤回由服务器的时限和权限规则决定。' busy={task.busy}
        onCancel={() => setRevoke(undefined)} onConfirm={() => {
          void task.run(async () => {
            await revokeMessage(id, revoke)
            setRevoke(undefined)
          }) 
        }}
      />}
      {!!task.error && <Text accessibilityRole='alert' style={styles.error}>{task.error}</Text>}
      {!state.historyEnd[id] && (
        <Button
          title='加载更早消息'
          onPress={() => {
            void loadHistory(id, true).catch(reportError)
          }}
        />
      )}
      {!!composer.draftError && <View>
        <Text accessibilityRole='alert' style={styles.error}>草稿恢复失败，当前输入已保留</Text>
        <Button title='重试恢复草稿' onPress={composer.retryDraft} />
      </View>}
      {!!state.error && (
        <Text accessibilityRole='alert' style={styles.error}>
          {state.error}
        </Text>
      )}
      {failed.map(message => (
        <Button
          key={message.clientMsgID}
          title={`发送失败，重试：${message.textElem?.content || message.fileElem?.fileName || '附件 / 语音'}`}
          onPress={() => {
            void retryMessage(id, message).catch(reportError)
          }}
        />
      ))}
      {!!reply && (
        <Text style={{ color: colors.subtitle, padding: 8 }}>
          引用回复仅支持文字；发送附件或语音前请取消引用。
        </Text>
      )}
      {locating && <Text accessibilityRole='text'>正在定位消息…</Text>}
      <AttachmentBatchTray batches={batches} onRetry={batchID => runAttachmentBatch(batchID).catch(reportError)} onCancel={cancelAttachmentBatch} />
      <Chat
        chatRef={chatRef}
        locale='zh-CN'
        text={composer.text}
        onDraftChange={composer.onDraftChange}
        textInputProps={{ onFocus: composer.onFocus, onBlur: composer.onBlur }}
        isTyping={composer.typingUsers.length > 0}
        messages={rawMessages.map(message => {
          const mapped = extras.map(toMessage(message))
          return parseCallInvitation(mapped.text) ? { ...mapped, text: '音视频通话邀请（15 分钟内有效）' } : mapped
        })}
        renderCustomView={({ currentMessage }) => <JoinCall text={rawMessages.find(message => message.clientMsgID === currentMessage?._id)?.textElem?.content || ''} />}
        onSend={onSend}
        onEditMessage={extras.edit}
        reactions={{ isEnabled: true, emojis: ['👍', '❤️', '😂', '😮', '😢', '🙏', '🔥', '🎉'], onReactionPress: extras.react, renderExpandedPicker: null }}
        user={{ _id: state.session.userID }}
        isGroupChat={!!conversation.groupID}
        reply={{ message: reply, onReply: setReply, onClear: () => setReply(null) }}
        attachments={reply ? false : {
          tabs: ['gallery', 'camera', 'file'],
          isGalleryGridEnabled: false,
          onPick: async (attachments, { caption }) => {
            try {
              assertMediaReplyAllowed(activeReply.current)
              if (batchSession.current !== state.session)
                throw new Error('登录已改变，请重新发送附件')
              await sendAttachmentBatchChecked(id, attachments.filter(attachment => attachment.type !== 'location').map(attachment => ({
                ...attachment,
                name: attachment.type === 'file' ? attachment.name : attachment.fileName,
              })), caption)
            } catch (error) {
              reportError(error)
            }
            return null
          },
        }}
        audioRecording={reply ? false : {
          isViewOnceEnabled: false,
          onError: reportError,
          onPermissionDenied: () => reportError(new Error('请在系统设置中允许麦克风访问')),
        }}
        videoRecording={false}
        onForwardMessage={message =>
          setForward(rawMessages.find(item => item.clientMsgID === message._id))}

        onRetryMessage={message => {
          const raw = rawMessages.find(item => item.clientMsgID === message._id)
          if (raw)
            void retryMessage(id, raw).catch(reportError)
        }}
        messageActions={(message, defaults) => {
          const raw = rawMessages.find(item => item.clientMsgID === message._id)
          if (!raw || raw.contentType >= 1000)
            return []
          const actions = defaults.filter(action => ['copy', 'retry'].includes(action.key || '') ||
            (raw.status === 2 && ['reply', 'forward'].includes(action.key || '')) ||
            (raw.status === 2 && raw.contentType === 101 && raw.sendID === state.session?.userID && !parseCallInvitation(raw.textElem?.content || '') && action.key === 'edit'))
          if (raw.sendID === state.session?.userID && raw.status === 2)
            actions.push({
              key: 'revoke',
              label: '撤回',
              destructive: true,
              onPress: () => setRevoke(raw.clientMsgID),
            })
          if (raw.groupID && raw.sendID === state.session?.userID && raw.status === 2 && (raw.seq || 0) > 0)
            actions.push({
              key: 'readers',
              label: '已读未读成员',
              onPress: () => router.push({ pathname: '/chats/readers/[id]', params: { id, messageID: raw.clientMsgID, seq: String(raw.seq) } }),
            })
          return actions
        }}
      />
    </View>
  )
}
const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { zIndex: 1, boxShadow: '0 0.5px 0 rgba(0, 0, 0, 0.12)' },
  headerBar: { height: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4 },
  headerButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  headerText: { flex: 1, marginStart: 13, justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '500', textAlign: 'left' },
  error: { color: '#b42318', padding: 8 },
})
