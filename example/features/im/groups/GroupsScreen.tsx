import React, { useCallback, useEffect, useState } from 'react'
import { Text, View } from 'react-native'
import { Href, useRouter } from 'expo-router'
import { directory, groupDirectoryEvents } from '@/features/im/application/directory'
import { useOpenIM } from '@/features/im/application/store'
import LoginScreen from '@/features/im/auth/LoginScreen'
import { mergeDirectory, type Group } from '@/features/im/domain/directory'
import { useTask } from '@/features/im/shared/useTask'
import { groupManagement, groupApplicationEvents } from '../application/group-management'
import { directorySummary } from '../contacts/contact-summary'
import { roleKey } from '../domain/group-management'
import { useT } from '../i18n'
import { Action } from '../shared/shared'
import { useDirectoryEvents } from '../shared/useDirectoryEvents'
import { ProductListRow, ProductSheet } from '../ui/primitives'
import { ProductIcon } from '../ui/ProductIcon'
import { ProductPage, ProductEmpty, ProductIconButton, ProductSection } from '../ui/ProductPage'
import { ProductSkeleton } from '../ui/ProductSkeleton'
import { useProductTheme } from '../ui/theme'
import { GroupAvatar } from './group-ui'

export default function GroupsScreen ({ root = false }: { root?: boolean }) {
  const { session } = useOpenIM()
  return session ? (
    <Groups userID={session.userID} root={root} key={`${session.userID}:${session.imToken}`} />
  ) : (
    <LoginScreen />
  )
}
function Groups ({ root, userID }: { root: boolean, userID: string }) {
  const tr = useT()
  const router = useRouter()
  const task = useTask()
  const { run } = task
  const [pending, setPending] = useState(0)
  const [roles, setRoles] = useState<Record<string, number | undefined>>({})
  const [groups, setGroups] = useState<Group[]>([])
  const [offset, setOffset] = useState(0)
  const [more, setMore] = useState(false)
  const refresh = useCallback(
    () =>
      run(async current => {
        const [page, pendingCount] = await Promise.all([
          directory.groups(),
          directorySummary(
            offset => groupManagement.requests(true, offset),
            current,
            item => item.handleResult === 0
          ),
        ])
        const roleEntries = await Promise.all(
          page.map(
            async group =>
              [group.groupID, (await directory.member(group.groupID, userID))?.roleLevel] as const
          )
        )
        if (current()) {
          setPending(pendingCount)
          setRoles(Object.fromEntries(roleEntries))
          setGroups(page)
          setOffset(page.length)
          setMore(page.length === 30)
        }
      }),
    [run, userID]
  )
  useDirectoryEvents([...groupDirectoryEvents, ...groupApplicationEvents], refresh, task.busy)
  useEffect(() => {
    void refresh()
  }, [refresh])
  const [menu, setMenu] = useState(false)
  const t = useProductTheme()
  // 入群申请 and the section title are there from the first frame; only the group rows wait.
  const loading = !task.hasSucceeded
  return (
    <ProductPage
      white
      root={root}
      title={tr('contacts.groupChats')}
      {...task}
      loading={loading}
      onRetry={() => {
        void refresh()
      }}
      right={<ProductIconButton name='plus' label={tr('chats.new')} onPress={() => setMenu(true)} />}
    >
      <ProductListRow
        small
        side={root}
        chevron
        titleWeight='500'
        title={tr('groups.joinRequests')}
        leading={
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              backgroundColor: t.surface2,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ProductIcon name='userPlus' color={t.text} />
          </View>
        }
        trailing={
          pending ? (
            <Text
              style={{
                backgroundColor: t.danger,
                color: '#fff',
                borderRadius: 9,
                paddingHorizontal: 6,
                fontSize: 12,
              }}
            >
              {pending}
            </Text>
          ) : undefined
        }
        onPress={() => router.push('/chats/groups/requests' as Href)}
      />
      <ProductSection variant='list'>
        {tr('groups.joined')}
        {loading ? '' : ` · ${groups.length}`}
        {more ? '+' : ''}
      </ProductSection>
      {loading && !task.error && <ProductSkeleton kind='list' small />}
      {!loading && !groups.length && !task.busy && (
        <ProductEmpty title={tr('groups.none')} subtitle={tr('groups.noneHint')} />
      )}
      {groups.map((group, index) => (
        <ProductListRow
          small
          side={root}
          last={index === groups.length - 1}
          key={group.groupID}
          title={group.groupName}
          subtitle={tr('groups.memberSummary', { count: group.memberCount || 0, role: roles[group.groupID] ? ` · ${tr(roleKey(roles[group.groupID]))}` : '' })}
          leading={<GroupAvatar group={group} size={44} />}
          trailing={<></>}
          onPress={() => router.push(`/chats/groups/${encodeURIComponent(group.groupID)}` as Href)}
        />
      ))}
      {menu && (
        <ProductSheet
          onClose={() => setMenu(false)}
          items={[
            {
              title: tr('chats.createGroup'),
              onPress: () => {
                setMenu(false)
                router.push('/chats/groups/create' as Href)
              },
            },
            {
              title: tr('chats.joinGroupByID'),
              onPress: () => {
                setMenu(false)
                router.push('/chats/groups/join' as Href)
              },
            },
          ]}
        />
      )}
      {more && (
        <Action
          title={tr('groups.loadMore')}
          disabled={task.busy}
          onPress={() => {
            void run(async current => {
              const page = await directory.groups(offset)
              const entries = await Promise.all(
                page.map(
                  async group =>
                    [
                      group.groupID,
                      (await directory.member(group.groupID, userID))?.roleLevel,
                    ] as const
                )
              )
              if (current()) {
                setRoles(items => ({ ...items, ...Object.fromEntries(entries) }))
                setGroups(items => mergeDirectory(items, page, item => item.groupID))
                setOffset(offset + page.length)
                setMore(page.length === 30)
              }
            })
          }}
        />
      )}
    </ProductPage>
  )
}
