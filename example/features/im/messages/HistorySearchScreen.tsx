import React, { useState } from 'react'
import { Text, View } from 'react-native'
import { Chat } from '@kesha-antonov/react-native-chat'
import { useRouter } from 'expo-router'
import { useChatListColors } from '@/components/chat-list/theme'
import { loadServerHistory, useOpenIM } from '@/features/im/application/store'
import LoginScreen from '@/features/im/auth/LoginScreen'
import { mergeMessages, toMessage } from '@/features/im/domain/model'
import type { IMMessage } from '@/features/im/domain/types'
import { Action, Field } from '@/features/im/shared/shared'
import { useTask } from '@/features/im/shared/useTask'

export default function HistorySearchScreen ({ id }: { id: string }) {
  const { session } = useOpenIM()
  if (!session)
    return <LoginScreen />
  return <SessionHistorySearch key={`${session.userID}:${session.imToken}:${id}`} id={id} />
}

function SessionHistorySearch ({ id }: { id: string }) {
  const state = useOpenIM()
  const colors = useChatListColors()
  const router = useRouter()
  const task = useTask()
  const [query, setQuery] = useState('')
  const [searched, setSearched] = useState('')
  const [cursor, setCursor] = useState('')
  const [hasMore, setHasMore] = useState(false)
  const [messages, setMessages] = useState<IMMessage[]>([])
  const search = (more = false) => {
    void task.run(async current => {
      const keyword = more ? searched : query.trim()
      if (!keyword)
        return
      const result = await loadServerHistory({ conversationID: id, query: keyword, cursor: more ? cursor : '' })
      if (current()) {
        setMessages(more ? mergeMessages(messages, result.messages) : result.messages)
        setHasMore(result.hasMore)
        setCursor(result.cursor)
        setSearched(keyword)
      }
    })
  }
  return (
    <View style={{ flex: 1, paddingTop: 56, backgroundColor: colors.background }}>
      <Action title='返回' onPress={() => router.back()} />
      <Text style={{ color: colors.name, padding: 12 }}>搜索服务端可访问的聊天记录</Text>
      <Field value={query} onChangeText={setQuery} placeholder='消息关键词' />
      <Action
        title={task.busy ? '搜索中…' : '搜索'}
        disabled={task.busy || !query.trim()}
        onPress={() => search()}
      />
      {!!task.error && <Text accessibilityRole='alert' style={{ color: colors.draft }}>{task.error}</Text>}
      {!!searched && (
        <Text style={{ color: colors.name, padding: 12 }}>
          {messages.length ? `已找到 ${messages.length} 条匹配消息` : hasMore ? '本段记录没有匹配消息，可继续搜索更早记录' : '未找到匹配消息'}
        </Text>
      )}
      {hasMore && <Action title='继续搜索更早记录' disabled={task.busy} onPress={() => search(true)} />}
      <Chat
        locale='zh-CN'
        messages={messages.map(toMessage)}
        user={{ _id: state.session?.userID || '' }}
        renderInputToolbar={() => null}
        renderChatEmpty={() => <Text style={{ color: colors.message, padding: 16 }}>输入关键词搜索聊天记录</Text>}
        messageActions={[]}
        onPressMessage={(_context, message) => {
          if (message?._id)
            router.push({ pathname: '/chats/[id]', params: { id, messageID: String(message._id) } })
        }}
        reply={{ isEnabled: false }}
      />
    </View>
  )
}
