import React, { useCallback, useEffect, useState } from 'react'
import { Href, useRouter } from 'expo-router'
import { directory , groupDirectoryEvents } from '@/features/im/application/directory'
import { useOpenIM } from '@/features/im/application/store'
import LoginScreen from '@/features/im/auth/LoginScreen'
import { mergeDirectory, type Group } from '@/features/im/domain/directory'
import { useTask } from '@/features/im/shared/useTask'
import { FriendPicker } from '../shared/FriendPicker'
import { Action, Field, Label, Page, PersonRow } from '../shared/shared'
import { useDirectoryEvents } from '../shared/useDirectoryEvents'

export default function GroupsScreen ({ root = false }: { root?: boolean }) {
  const { session } = useOpenIM()
  return session ? <Groups root={root} key={session.userID} /> : <LoginScreen />
}
function Groups ({ root }: { root: boolean }) {
  const router = useRouter()
  const task = useTask()
  const { run } = task
  const [groups, setGroups] = useState<Group[]>([])
  const [offset, setOffset] = useState(0)
  const [more, setMore] = useState(false)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const refresh = useCallback(
    () =>
      run(async current => {
        const page = await directory.groups()
        if (current()) {
          setGroups(page)
          setOffset(page.length)
          setMore(page.length === 30)
        }
      }),
    [run]
  )
  useDirectoryEvents(groupDirectoryEvents, refresh, task.busy)
  useEffect(() => {
    void refresh()
  }, [refresh])
  return (
    <Page root={root} title='群组' {...task}>
      <Action
        title='刷新群组'
        disabled={task.busy}
        onPress={() => {
          void refresh()
        }}
      />
      <Action
        title={creating ? '收起创建群组' : '创建群组'}
        disabled={task.busy}
        onPress={() => setCreating(!creating)}
      />
      {creating && (
        <>
          <Field value={name} onChangeText={setName} placeholder='群名称' />
          <FriendPicker selected={selected} onChange={setSelected} disabled={task.busy} />
          <Action
            title='创建群组'
            disabled={task.busy || !name.trim() || !selected.length}
            onPress={() => {
              void run(async current => {
                const group = await directory.create(name.trim(), selected)
                if (current()) {
                  setCreating(false)
                  setName('')
                  setSelected([])
                  setGroups(items => mergeDirectory(items, [group], item => item.groupID))
                  router.push(`/chats/groups/${encodeURIComponent(group.groupID)}` as Href)
                }
              })
            }}
          />
        </>
      )}
      <Action title='群申请' onPress={() => router.push('/chats/groups/requests' as Href)} />
      <Action title='通过群 ID 加群' onPress={() => router.push('/chats/groups/join' as Href)} />
      <Label>已加入的群组</Label>
      {!groups.length && !task.busy && <Label>暂无群组</Label>}
      {groups.map(group => (
        <PersonRow
          key={group.groupID}
          person={{ userID: group.groupID, nickname: group.groupName, faceURL: group.faceURL }}
        >
          <Action
            title={`群详情 · ${group.memberCount || 0} 人`}
            onPress={() =>
              router.push(`/chats/groups/${encodeURIComponent(group.groupID)}` as Href)
            }
          />
        </PersonRow>
      ))}
      {more && (
        <Action
          title='加载更多群组'
          disabled={task.busy}
          onPress={() => {
            void run(async current => {
              const page = await directory.groups(offset)
              if (current()) {
                setGroups(items => mergeDirectory(items, page, item => item.groupID))
                setOffset(offset + page.length)
                setMore(page.length === 30)
              }
            })
          }}
        />
      )}
    </Page>
  )
}
