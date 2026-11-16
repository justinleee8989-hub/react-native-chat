import React, { useCallback, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { ChatList } from '@kesha-antonov/react-native-chat'
import { Href, useFocusEffect, useRouter } from 'expo-router'
import {
  refresh,
  reportError,
  useOpenIM,
  setPinned,
  setMuted,
  removeConversations,
  setArchived,
} from '@/features/im/application/store'
import { toChat } from '@/features/im/domain/model'
import { useChatListColors } from '../../../components/chat-list/theme'
import { parseCallInvitation } from '../calls/invitation'
import { Confirm } from '../shared/shared'
import { useTask } from '../shared/useTask'

export default function ChatListScreen({ archived = false }: { archived?: boolean }) {
  const { session } = useOpenIM()
  if (!session)
    return null
  return <SessionChatList key={`${session.userID}:${session.imToken}`} archived={archived} />
}

function SessionChatList ({ archived }: { archived: boolean }) {
  const router = useRouter()
  const task = useTask()
  const [deleting, setDeleting] = useState<string[]>([])
  const state = useOpenIM()
  const colors = useChatListColors()
  const refreshing = useRef(false)
  useFocusEffect(useCallback(() => {
    if (!state.session)
      return
    let focused = true
    const sync = async () => {
      if (!focused || refreshing.current || state.busy)
        return
      refreshing.current = true
      try {
        await refresh()
      } catch (error) {
        reportError(error)
      } finally {
        refreshing.current = false
      }
    }
    void sync()
    const timer = setInterval(() => {
      void sync()
    }, 5000)
    return () => {
      focused = false
      clearInterval(timer)
    }
  }, [state.session, state.busy]))
  if (!state.session) 
    return null
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ChatList
        chats={state.conversations.map(conversation => {
          const chat = toChat(conversation, state.session?.userID)
          if (chat.lastMessage && parseCallInvitation(chat.lastMessage.text))
            chat.lastMessage = { ...chat.lastMessage, text: '音视频通话邀请' }
          return chat
        })}
        user={{ _id: state.session.userID }}
        title='消息'
        locale='zh-CN'
        onPinChats={(chats, pinned) => {
          void task.run(async () => {
            await setPinned(
              chats.map(chat => String(chat.id)),
              pinned
            )
          })
        }}
        onMuteChats={(chats, muted) => {
          void task.run(async () => {
            await setMuted(
              chats.map(chat => String(chat.id)),
              muted
            )
          })
        }}
        onArchiveChats={(chats, isArchived) => {
          void task.run(async () => {
            await setArchived(chats.map(chat => String(chat.id)), isArchived)
          })
        }}
        onArchiveOpenChange={isOpen => {
          if (isOpen && !archived)
            router.push('/chats/archived' as Href)
          else if (!isOpen && archived)
            router.replace('/(tabs)/chats')
        }}
        isDeleteConfirmed={false}
        onDeleteChats={chats => setDeleting(chats.map(chat => String(chat.id)))}
        isLoading={state.busy}
        isArchiveOpen={archived}
        onPressChat={chat => router.push(`/chats/${encodeURIComponent(chat.id)}` as Href)}
        onPressNewChat={() => router.push('/chats/new' as Href)}
        renderHeaderRight={() => (
          <Pressable
            accessibilityRole='button'
            accessibilityLabel='通话记录'
            onPress={() => router.push('/chats/call-history' as Href)}
            style={styles.action}
          >
            <MaterialCommunityIcons name='phone-outline' size={22} color={colors.headerIcon} />
          </Pressable>
        )}
        listProps={{
          refreshing: state.busy,
          onRefresh: () => {
            void refresh().catch(reportError)
          },
        }}
      />
      <Text style={{ padding: 8, color: colors.message }}>
        {state.session.userID} · {state.status}
      </Text>
      {!!task.error && (
        <Text accessibilityRole='alert' style={{ color: colors.draft }}>
          {task.error}
        </Text>
      )}
      {deleting.length > 0 && (
        <Confirm
          error={task.error}
          message={`确认删除 ${deleting.length} 个会话及其聊天记录？此操作无法在界面中撤销。`}
          busy={task.busy}
          onCancel={() => setDeleting([])}
          onConfirm={() => {
            void task.run(async current => {
              await removeConversations(deleting)
              if (current())
                setDeleting([])
            })
          }}
        />
      )}
      {!!state.error && (
        <Text accessibilityRole='alert' style={{ color: '#b42318', padding: 8 }}>
          {state.error}
        </Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', alignItems: 'center' },
  action: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
})
