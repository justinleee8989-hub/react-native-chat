import React, { useState } from 'react'
import { Href, useLocalSearchParams, useRouter } from 'expo-router'
import {
  clearConversation,
  removeConversations,
  setMuted,
  setPinned,
  setArchived,
  useOpenIM,
} from '../application/store'
import LoginScreen from '../auth/LoginScreen'
import { isConversationArchived } from '../domain/conversation-archive'
import { Action, Confirm, Label, Page } from '../shared/shared'
import { useTask } from '../shared/useTask'

export default function ConversationSettingsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const state = useOpenIM()
  return state.session ? (
    <Settings key={`${state.session.userID}:${state.session.imToken}:${id}`} id={id} />
  ) : (
    <LoginScreen />
  )
}
function Settings({ id }: { id: string }) {
  const state = useOpenIM()
  const router = useRouter()
  const task = useTask()
  const [confirmation, setConfirmation] = useState<'clear' | 'delete'>()
  const conversation = state.conversations.find(item => item.conversationID === id)
  if (!conversation)
    return (
      <Page title='会话设置' {...task}>
        <Label>会话不存在，请返回列表。</Label>
      </Page>
    )
  return (
    <Page title='会话设置' {...task}>
      <Label>{conversation.showName}</Label>
      <Action
        title={conversation.isPinned ? '取消置顶' : '置顶会话'}
        disabled={task.busy}
        onPress={() => {
          void task.run(async () => {
            await setPinned([id], !conversation.isPinned)
          })
        }}
      />
      <Action
        title={conversation.recvMsgOpt === 2 ? '关闭免打扰' : '开启免打扰'}
        disabled={task.busy}
        onPress={() => {
          void task.run(async () => {
            await setMuted([id], conversation.recvMsgOpt !== 2)
          })
        }}
      />
      <Action
        title={isConversationArchived(conversation.ex, state.session?.userID || '') ? '取消归档' : '归档会话'}
        disabled={task.busy}
        onPress={() => {
          const archived = isConversationArchived(conversation.ex, state.session?.userID || '')
          void task.run(async current => {
            await setArchived([id], !archived)
            if (current() && !archived)
              router.replace('/chats' as Href)
          })
        }}
      />
      <Action
        title='搜索聊天记录'
        onPress={() => router.push(`/chats/search/${encodeURIComponent(id)}` as Href)}
      />
      <Action
        title='图片、文件与链接'
        onPress={() => router.push(`/chats/assets/${encodeURIComponent(id)}` as Href)}
      />
      {conversation.groupID ? (
        <Action
          title='群资料和成员'
          onPress={() => router.push(`/chats/groups/${conversation.groupID}` as Href)}
        />
      ) : (
        conversation.userID && (
          <Action
            title='联系人资料'
            onPress={() => router.push(`/chats/people/${conversation.userID}` as Href)}
          />
        )
      )}
      <Action
        title='清空聊天记录'
        danger
        disabled={task.busy}
        onPress={() => setConfirmation('clear')}
      />
      <Action
        title='删除会话及聊天记录'
        danger
        disabled={task.busy}
        onPress={() => setConfirmation('delete')}
      />
      {confirmation && (
        <Confirm error={task.error}
          message={
            confirmation === 'delete'
              ? '确认删除这个会话及当前账号的聊天记录？此操作无法在界面中撤销，不会替对方删除消息。'
              : '确认清空当前账号在此会话的聊天记录？此操作无法在界面中撤销。'
          }
          busy={task.busy}
          onCancel={() => setConfirmation(undefined)}
          onConfirm={() => {
            void task.run(async current => {
              if (confirmation === 'clear') 
                await clearConversation(id)
              else 
                await removeConversations([id])
              if (!current()) 
                return
              setConfirmation(undefined)
              if (confirmation === 'delete') 
                router.replace('/chats' as Href)
            })
          }}
        />
      )}
    </Page>
  )
}
