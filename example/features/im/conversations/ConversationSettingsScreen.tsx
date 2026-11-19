import React, { useEffect, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { Href, useLocalSearchParams, useRouter } from 'expo-router'
import { directory } from '../application/directory'
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
import type { Group, Person } from '../domain/directory'
import { useT } from '../i18n'
import { Confirm } from '../shared/shared'
import { useTask } from '../shared/useTask'
import { ProductAvatar, ProductCard, ProductRow, ProductSwitch } from '../ui/primitives'
import { ProductIcon } from '../ui/ProductIcon'
import { ProductPage } from '../ui/ProductPage'
import { useProductTheme } from '../ui/theme'

export default function ConversationSettingsScreen () {
  const { id } = useLocalSearchParams<{ id: string }>()
  const state = useOpenIM()
  return state.session ? (
    <Settings key={`${state.session.userID}:${state.session.imToken}:${id}`} id={id} />
  ) : (
    <LoginScreen />
  )
}
function Settings ({ id }: { id: string }) {
  const tr = useT()
  const state = useOpenIM()
  const router = useRouter()
  const task = useTask()
  const [confirmation, setConfirmation] = useState<'clear' | 'delete'>()
  const conversation = state.conversations.find(item => item.conversationID === id)
  const t = useProductTheme()
  const { run } = task
  const [group, setGroup] = useState<Group>()
  const [members, setMembers] = useState<Person[]>([])
  const groupID = conversation?.groupID
  useEffect(() => {
    if (groupID)
      void run(async current => {
        const [info, people] = await Promise.all([
          directory.group(groupID),
          directory.members(groupID),
        ])
        if (current()) {
          setGroup(info)
          setMembers(people)
        }
      })
  }, [groupID, run])
  const groupLink = () => router.push(`/chats/groups/${encodeURIComponent(groupID || '')}` as Href)
  const archived = isConversationArchived(conversation?.ex, state.session?.userID || '')
  return (
    <ProductPage title={tr('chatInfo.title')} {...task} backHref='/chats'>
      {!conversation ? (
        <Text style={{ color: t.text2, padding: 20 }}>{tr('chatInfo.notFound')}</Text>
      ) : (
        <View style={{ marginHorizontal: 16, marginTop: 12, gap: 24 }}>
          {groupID ? (
            <>
              <ProductCard>
                <View
                  style={{
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    paddingVertical: 16,
                    paddingHorizontal: 10,
                    rowGap: 16,
                  }}
                >
                  {members.slice(0, 9).map(member => (
                    <Pressable
                      key={member.userID}
                      accessibilityRole='button'
                      onPress={() =>
                        router.push(`/chats/people/${encodeURIComponent(member.userID)}` as Href)
                      }
                      style={{ width: '20%', alignItems: 'center', gap: 6 }}
                    >
                      <ProductAvatar
                        id={member.userID}
                        title={member.nickname || member.userID}
                        uri={member.faceURL}
                        size={48}
                      />
                      <Text
                        numberOfLines={1}
                        style={{ color: t.text2, fontSize: 12, maxWidth: '90%' }}
                      >
                        {member.nickname || member.userID}
                      </Text>
                    </Pressable>
                  ))}
                  <Pressable
                    accessibilityRole='button'
                    onPress={() =>
                      router.push(`/chats/groups/invite?id=${encodeURIComponent(groupID)}` as Href)
                    }
                    style={{ width: '20%', alignItems: 'center', gap: 6 }}
                  >
                    <View
                      style={{
                        width: 48,
                        height: 48,
                        borderWidth: 1.5,
                        borderStyle: 'dashed',
                        borderColor: t.text3,
                        borderRadius: 24,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <ProductIcon name='plus' color={t.text3} />
                    </View>
                    <Text style={{ color: t.text2, fontSize: 12 }}>{tr('chatInfo.invite')}</Text>
                  </Pressable>
                </View>
                <ProductRow
                  title={tr('chatInfo.allMembers')}
                  trailing={
                    <Text style={{ color: t.text2, fontSize: 15 }}>
                      {tr('chatInfo.memberCount', { count: group?.memberCount ?? members.length })}
                    </Text>
                  }
                  onPress={() =>
                    router.push(`/chats/groups/members?id=${encodeURIComponent(groupID)}` as Href)
                  }
                />
              </ProductCard>
              <ProductCard>
                <ProductRow
                  title={tr('chatInfo.groupProfile')}
                  trailing={
                    <Text
                      numberOfLines={1}
                      style={{ color: t.text2, fontSize: 15, maxWidth: '55%' }}
                    >
                      {group?.groupName || conversation.showName}
                    </Text>
                  }
                  onPress={groupLink}
                />
                <ProductRow
                  title={tr('chatInfo.announcement')}
                  trailing={
                    <Text
                      numberOfLines={1}
                      style={{ color: t.text2, fontSize: 15, maxWidth: '55%' }}
                    >
                      {group?.notification || tr('person.notSet')}
                    </Text>
                  }
                  onPress={groupLink}
                />
              </ProductCard>
            </>
          ) : (
            <ProductCard>
              <ProductRow
                title={conversation.showName}
                subtitle={tr('common.idLabel', { id: conversation.userID || '' })}
                leading={
                  <ProductAvatar
                    id={conversation.userID || id}
                    title={conversation.showName}
                    uri={conversation.faceURL}
                    size={48}
                  />
                }
                onPress={() => {
                  if (conversation.userID)
                    router.push(`/chats/people/${encodeURIComponent(conversation.userID)}` as Href)
                }}
              />
            </ProductCard>
          )}
          <ProductCard>
            <ProductRow
              title={tr('chatInfo.searchHistory')}
              onPress={() => router.push(`/chats/search/${encodeURIComponent(id)}` as Href)}
            />
            <ProductRow
              title={tr('chatInfo.media')}
              onPress={() => router.push(`/chats/assets/${encodeURIComponent(id)}` as Href)}
            />
          </ProductCard>
          <ProductCard>
            <ProductRow
              title={tr('chatInfo.pin')}
              trailing={
                <ProductSwitch
                  accessibilityLabel={tr('chatInfo.pin')}
                  disabled={task.busy}
                  value={!!conversation.isPinned}
                  onValueChange={value => {
                    void run(async () => {
                      await setPinned([id], value)
                    })
                  }}
                />
              }
            />
            <ProductRow
              title={tr('chatInfo.mute')}
              trailing={
                <ProductSwitch
                  accessibilityLabel={tr('chatInfo.mute')}
                  disabled={task.busy}
                  value={conversation.recvMsgOpt === 2}
                  onValueChange={value => {
                    void run(async () => {
                      await setMuted([id], value)
                    })
                  }}
                />
              }
            />
            <ProductRow
              title={tr('chatInfo.archive')}
              trailing={
                <ProductSwitch
                  accessibilityLabel={tr('chatInfo.archive')}
                  disabled={task.busy}
                  value={archived}
                  onValueChange={value => {
                    void run(async () => {
                      await setArchived([id], value)
                    })
                  }}
                />
              }
            />
          </ProductCard>
          <ProductCard>
            <ProductRow
              title={tr('chatInfo.clearHistory')}
              danger
              centered
              onPress={() => {
                if (!task.busy)
                  setConfirmation('clear')
              }}
            />
            <ProductRow
              title={tr('chatInfo.deleteChat')}
              danger
              centered
              onPress={() => {
                if (!task.busy)
                  setConfirmation('delete')
              }}
            />
          </ProductCard>
        </View>
      )}
      {confirmation && (
        <Confirm
          error={task.error}
          title={confirmation === 'delete' ? tr('chatInfo.deleteChatTitle') : tr('chatInfo.clearHistoryTitle')}
          confirmLabel={confirmation === 'delete' ? tr('common.delete') : tr('chatInfo.clear')}
          message={
            confirmation === 'delete'
              ? tr('chatInfo.deleteChatMessage')
              : tr('chatInfo.clearHistoryMessage')
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
                router.dismissTo('/(tabs)/chats')
            })
          }}
        />
      )}
    </ProductPage>
  )
}
