import React, { useCallback, useEffect, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { Href, useLocalSearchParams, useRouter } from 'expo-router'
import { directory, groupDirectoryEvents } from '@/features/im/application/directory'
import { openConversation, useOpenIM } from '@/features/im/application/store'
import LoginScreen from '@/features/im/auth/LoginScreen'
import { type Group, type Person } from '@/features/im/domain/directory'
import { useTask } from '@/features/im/shared/useTask'
import { startConversationCall } from '../calls/CallControls'
import { useDirectoryEvents } from '../shared/useDirectoryEvents'
import { ProductCard, ProductRow } from '../ui/primitives'
import { ProductIcon } from '../ui/ProductIcon'
import { ProductPage, ProductIconButton, ProductInset, ProductSection } from '../ui/ProductPage'
import { useProductTheme } from '../ui/theme'
import { GroupAvatar, MemberRow } from './group-ui'

export default function GroupScreen () {
  const { session } = useOpenIM()
  const { id } = useLocalSearchParams<{ id: string }>()
  return session ? (
    <GroupDetails
      key={`${session.userID}:${session.imToken}:${id}`}
      groupID={id}
      userID={session.userID}
    />
  ) : (
    <LoginScreen />
  )
}
function GroupDetails ({ groupID, userID }: { groupID: string, userID: string }) {
  const router = useRouter()
  const task = useTask()
  const { run } = task
  const [group, setGroup] = useState<Group>()
  const [self, setSelf] = useState<Person>()
  const [members, setMembers] = useState<Person[]>([])
  const reload = useCallback(
    async (current: () => boolean) => {
      const [info, people, member] = await Promise.all([
        directory.group(groupID),
        directory.members(groupID),
        directory.member(groupID, userID),
      ])
      if (!current())
        return
      if (!info)
        throw new Error('群组不存在或无法访问')
      setGroup(info)
      setMembers(people)
      setSelf(member)
    },
    [groupID, userID]
  )
  const refresh = useCallback(() => run(reload), [run, reload])
  useDirectoryEvents(groupDirectoryEvents, refresh, task.busy, groupID)
  useEffect(() => {
    void run(reload)
  }, [run, reload])
  const t = useProductTheme()
  return (
    <ProductPage
      title=''
      {...task}
      // What this page shows depends on the group and this user's role, so it waits whole, behind
      // a placeholder drawn to its header and grouped cards.
      initialLoading={!task.hasSucceeded}
      skeleton='profile'
      skeletonGroup
      onRetry={() => {
        void refresh()
      }}
      right={
        self ? (
          <ProductIconButton
            name='more'
            label='群管理'
            onPress={() =>
              router.push(`/chats/groups/manage?id=${encodeURIComponent(groupID)}` as Href)
            }
          />
        ) : undefined
      }
    >
      {group && (
        <>
          <View
            style={{
              alignItems: 'center',
              paddingTop: 20,
              paddingBottom: 4,
              paddingHorizontal: 24,
              gap: 4,
            }}
          >
            <GroupAvatar group={group} size={96} />
            <Text
              style={{
                color: t.text,
                fontSize: 24,
                lineHeight: 30,
                letterSpacing: -0.3,
                fontWeight: '700',
                marginTop: 12,
                textAlign: 'center',
              }}
            >
              {group.groupName}
            </Text>
            <Text style={{ color: t.text2, fontSize: 14, lineHeight: 20, textAlign: 'center' }}>
              {group.memberCount || members.length} 位成员 ·{' '}
              {self
                ? `我是${self.roleLevel === 100 ? '群主' : self.roleLevel === 60 ? '管理员' : '群成员'}`
                : '未加入'}
            </Text>
          </View>
          {self && (
            <View
              style={{
                flexDirection: 'row',
                gap: 12,
                marginHorizontal: 16,
                marginTop: 22,
                justifyContent: 'center',
              }}
            >
              {[
                { title: '发消息', icon: 'chat' as const },
                { title: '音视频通话', icon: 'video' as const },
              ].map(action => (
                <Pressable
                  key={action.title}
                  accessibilityRole='button'
                  disabled={task.busy}
                  onPress={() => {
                    void run(async current => {
                      const id = await openConversation(groupID, 3)
                      if (!current())
                        return
                      if (action.icon === 'video')
                        await startConversationCall({ groupID, showName: group.groupName }, id)
                      if (current())
                        router.push(`/chats/${encodeURIComponent(id)}` as Href)
                    })
                  }}
                  style={{
                    flex: 1,
                    maxWidth: 168,
                    height: 64,
                    borderRadius: 16,
                    backgroundColor: t.surface,
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 5,
                    opacity: task.busy ? 0.4 : 1,
                  }}
                >
                  <ProductIcon name={action.icon} size={24} color={t.accent} />
                  <Text style={{ color: t.accent, fontSize: 12.5, fontWeight: '500' }}>
                    {action.title}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}

          <ProductSection>群公告</ProductSection>
          <ProductInset>
            <ProductCard>
              <Text
                style={{
                  padding: 16,
                  fontSize: 15,
                  lineHeight: 24,
                  color: group.notification ? t.text : t.text3,
                }}
              >
                {group.notification || '暂无群公告'}
              </Text>
            </ProductCard>
          </ProductInset>
          <ProductSection>基本信息</ProductSection>
          <ProductInset>
            <ProductCard>
              <ProductRow
                title='群 ID'
                trailing={
                  <Text
                    selectable
                    numberOfLines={1}
                    style={{ color: t.text2, fontSize: 15, maxWidth: '58%' }}
                  >
                    {groupID}
                  </Text>
                }
              />
            </ProductCard>
          </ProductInset>
          <ProductSection>群成员 · {group.memberCount || members.length}</ProductSection>
          <ProductInset>
            <ProductCard>
              {members.slice(0, 5).map(member => (
                <MemberRow
                  key={member.userID}
                  member={member}
                  onPress={() =>
                    router.push(`/chats/people/${encodeURIComponent(member.userID)}` as Href)
                  }
                />
              ))}
              {(group.memberCount || members.length) > 5 && (
                <ProductRow
                  title='查看全部成员'
                  onPress={() =>
                    router.push(`/chats/groups/members?id=${encodeURIComponent(groupID)}` as Href)
                  }
                />
              )}
            </ProductCard>
          </ProductInset>
        </>
      )}
    </ProductPage>
  )
}
