import React, { useCallback, useEffect, useState } from 'react'
import { Text, View } from 'react-native'
import { Href, useRouter, useLocalSearchParams } from 'expo-router'
import { directory, groupDirectoryEvents } from '../application/directory'
import { checkGroupManagement, groupManagement } from '../application/group-management'
import { useOpenIM } from '../application/store'
import LoginScreen from '../auth/LoginScreen'
import {
  canRemoveMember,
  groupPermissions,
  mergeDirectory,
  type Person,
  type Group,
} from '../domain/directory'
import { groupManagementPermissions, groupMuteLabel } from '../domain/group-management'
import { ProductPromptField } from '../shared/ProductPromptField'
import { showProductToast } from '../shared/ProductToast'
import { Action, Confirm } from '../shared/shared'
import { useDirectoryEvents } from '../shared/useDirectoryEvents'
import { useTask } from '../shared/useTask'
import { ProductCard, ProductRow, ProductSheet, ProductSwitch } from '../ui/primitives'
import { ProductPage, ProductInset, ProductSection, ProductEmpty } from '../ui/ProductPage'
import { useProductTheme } from '../ui/theme'
import { MemberRow, ProductHint } from './group-ui'

type Pending = {
  message: string
  title?: string
  confirmLabel?: string
  permission: 'manage' | 'role' | 'transfer' | 'muteMember'
  targetID?: string
  action: () => Promise<unknown>
}
export default function GroupManagementScreen ({ membersPage = false }: { membersPage?: boolean }) {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { session } = useOpenIM()
  return session ? (
    <Management
      key={`${session.userID}:${session.imToken}:${id}`}
      membersPage={membersPage}
      groupID={id}
      userID={session.userID}
    />
  ) : (
    <LoginScreen />
  )
}
function Management ({
  groupID,
  userID,
  membersPage,
}: {
  groupID: string
  userID: string
  membersPage: boolean
}) {
  const router = useRouter()
  const t = useProductTheme()
  const { manage } = useLocalSearchParams<{ manage?: string }>()
  const [selected, setSelected] = useState<Person>()
  const [edit, setEdit] = useState<'name' | 'notice'>()
  const [draft, setDraft] = useState('')
  const [exit, setExit] = useState(false)
  const task = useTask()
  const { run } = task
  const [group, setGroup] = useState<Group>()
  const [self, setSelf] = useState<Person>()
  const [members, setMembers] = useState<Person[]>([])
  const unavailable = group?.status === 1 || group?.status === 2
  const managesMembers = !!manage && groupManagementPermissions(self).manage
  const [offset, setOffset] = useState(0)
  const [more, setMore] = useState(false)
  const setNotice = showProductToast
  const [pending, setPendingState] = useState<Pending>()
  const setPending = (value: Pending | undefined) => {
    setSelected(undefined)
    setPendingState(value)
  }
  const reload = useCallback(
    async (current: () => boolean, offset = 0) => {
      const [member, page, info] = await Promise.all([
        directory.member(groupID, userID),
        directory.members(groupID, offset),
        directory.group(groupID),
      ])
      if (current()) {
        setGroup(info)
        setSelf(member)
        setMembers(items => (offset ? mergeDirectory(items, page, item => item.userID) : page))
        setOffset(offset + page.length)
        setMore(page.length === 30)
      }
    },
    [groupID, userID]
  )
  const refresh = useCallback(() => run(current => reload(current)), [run, reload])
  useEffect(() => {
    void refresh()
  }, [refresh])
  useDirectoryEvents(groupDirectoryEvents, refresh, task.busy, groupID)
  const execute = (operation: Pending) => {
    void run(async current => {
      await checkGroupManagement(groupID, userID, current, operation.permission, operation.targetID)
      if (!current())
        return
      await operation.action()
      if (!current())
        return
      setSelected(undefined)
      setPending(undefined)
      setNotice('操作成功')
      await reload(current)
    })
  }
  const memberItems = selected
    ? (() => {
      const permissions = groupManagementPermissions(self, selected)
      const name = selected.nickname || selected.userID
      const muted =
        (selected.muteEndTime || 0) / ((selected.muteEndTime || 0) > 100000000000 ? 1000 : 1) >
          Date.now() / 1000
      const operation = (
        permission: Pending['permission'],
        action: Pending['action']
      ): Pending => ({ message: '', permission, targetID: selected.userID, action })
      return [
        {
          title: '查看资料',
          onPress: () => {
            setSelected(undefined)
            router.push(`/chats/people/${encodeURIComponent(selected.userID)}` as Href)
          },
        },
        ...(permissions.role
          ? [
            {
              title: selected.roleLevel === 60 ? '取消管理员' : '设为管理员',
              onPress: () =>
                execute(
                  operation('role', () =>
                    groupManagement.role(groupID, selected.userID, selected.roleLevel !== 60)
                  )
                ),
            },
          ]
          : []),
        ...(permissions.transfer
          ? [
            {
              title: '转让群主',
              onPress: () =>
                setPending({
                  ...operation('transfer', () =>
                    groupManagement.transfer(groupID, selected.userID)
                  ),
                  title: `将群主转让给 ${name}？`,
                  message: '转让后你将成为普通成员。',
                  confirmLabel: '转让',
                }),
            },
          ]
          : []),
        ...(permissions.muteMember
          ? [
            {
              title: muted ? '解除禁言' : '禁言 1 小时',
              onPress: () =>
                execute(
                  operation('muteMember', () =>
                    groupManagement.muteMember(groupID, selected.userID, muted ? 0 : 3600)
                  )
                ),
            },
          ]
          : []),
        ...(canRemoveMember(self, selected)
          ? [
            {
              title: '移出群组',
              danger: true,
              onPress: () =>
                setPending({
                  ...operation('muteMember', () => directory.kick(groupID, selected.userID)),
                  title: `将 ${name} 移出群组？`,
                  message: '',
                  confirmLabel: '移出',
                }),
            },
          ]
          : []),
      ]
    })()
    : []
  return (
    <ProductPage
      title={membersPage ? (managesMembers ? '成员管理' : '群成员') : '群管理'}
      subtitle={membersPage ? `${group?.memberCount || members.length} 人` : undefined}
      {...task}
      // Which sections show depends on this user's role, so the page waits whole.
      initialLoading={!task.hasSucceeded}
      skeleton={membersPage ? 'members' : 'settings'}
      onRetry={() => {
        void refresh()
      }}
    >
      {unavailable && (
        <ProductEmpty
          title={group?.status === 2 ? '群聊已解散' : '群聊当前不可用'}
          subtitle='无法继续管理此群聊，请返回会话列表。'
        />
      )}
      {!unavailable && !membersPage && group && (
        <>
          {groupManagementPermissions(self).manage && (
            <>
              <ProductSection>群资料</ProductSection>
              <ProductInset>
                <ProductCard>
                  <ProductRow
                    title='群聊名称'
                    trailing={
                      <Text
                        numberOfLines={1}
                        style={{ color: t.text2, fontSize: 15, maxWidth: '58%' }}
                      >
                        {group.groupName}
                      </Text>
                    }
                    onPress={() => {
                      setDraft(group.groupName)
                      setEdit('name')
                    }}
                  />
                  <ProductRow
                    title='群公告'
                    trailing={
                      <Text
                        numberOfLines={1}
                        style={{ color: t.text2, fontSize: 15, maxWidth: '60%' }}
                      >
                        {group.notification || '未设置'}
                      </Text>
                    }
                    onPress={() => {
                      setDraft(group.notification || '')
                      setEdit('notice')
                    }}
                  />
                </ProductCard>
              </ProductInset>
            </>
          )}
          <ProductSection>成员</ProductSection>
          <ProductInset>
            <ProductCard>
              {groupPermissions(self, group.needVerification).invite && (
                <ProductRow
                  title='邀请好友入群'
                  onPress={() =>
                    router.push(`/chats/groups/invite?id=${encodeURIComponent(groupID)}` as Href)
                  }
                />
              )}
              {groupManagementPermissions(self).manage && (
                <ProductRow
                  title='成员管理'
                  trailing={
                    <Text style={{ color: t.text2, fontSize: 15 }}>
                      {group.memberCount || members.length} 人
                    </Text>
                  }
                  onPress={() =>
                    router.push(
                      `/chats/groups/members?id=${encodeURIComponent(groupID)}${groupManagementPermissions(self).manage ? '&manage=1' : ''}` as Href
                    )
                  }
                />
              )}
            </ProductCard>
          </ProductInset>
          {groupManagementPermissions(self).manage ? (
            <>
              <ProductSection>权限</ProductSection>
              <ProductInset>
                <ProductCard>
                  <ProductRow
                    title='全员禁言'
                    trailing={
                      <ProductSwitch
                        accessibilityLabel='全员禁言'
                        value={group.status === 3}
                        disabled={task.busy}
                        onValueChange={value =>
                          execute({
                            message: '',
                            permission: 'manage',
                            action: () => groupManagement.muteGroup(groupID, value),
                          })
                        }
                      />
                    }
                  />
                </ProductCard>
              </ProductInset>
              <ProductHint>
                开启后只有群主和管理员可以发言。
                {group.status !== 0 && group.status !== 3 ? groupMuteLabel(group.status) : ''}
              </ProductHint>
            </>
          ) : null}
          {(groupPermissions(self).leave || groupPermissions(self).dismiss) && (
            <>
              <View style={{ height: 24 }} />
              <ProductInset>
                <ProductCard>
                  <ProductRow
                    title={groupPermissions(self).dismiss ? '解散群组' : '退出群组'}
                    danger
                    centered
                    onPress={() => setExit(true)}
                  />
                </ProductCard>
              </ProductInset>
            </>
          )}
        </>
      )}
      {!unavailable && membersPage && (
        <>
          {managesMembers && <ProductHint>点成员可设置管理员、禁言或移出群组。</ProductHint>}
          {managesMembers && <View style={{ height: 12 }} />}
          <ProductInset>
            <ProductCard>
              {[...members]
                .sort((a, b) => (b.roleLevel || 0) - (a.roleLevel || 0))
                .map(member => (
                  <MemberRow
                    key={member.userID}
                    member={member}
                    onPress={() => {
                      if (managesMembers && member.userID !== userID)
                        setSelected(member)
                      else
                        router.push(`/chats/people/${encodeURIComponent(member.userID)}` as Href)
                    }}
                  />
                ))}
            </ProductCard>
          </ProductInset>
        </>
      )}
      {selected && (
        <ProductSheet
          title={selected.nickname || selected.userID}
          subtitle={
            selected.roleLevel === 100 ? '群主' : selected.roleLevel === 60 ? '管理员' : '群成员'
          }
          busy={task.busy}
          onClose={() => setSelected(undefined)}
          items={memberItems}
        >
          {!!task.error && (
            <Text accessibilityRole='alert' style={{ color: t.danger }}>
              {task.error}
            </Text>
          )}
        </ProductSheet>
      )}
      {!unavailable && membersPage && more && (
        <Action
          title='加载更多成员'
          disabled={task.busy}
          onPress={() => {
            void run(current => reload(current, offset))
          }}
        />
      )}
      {pending && (
        <Confirm
          title={pending.title}
          confirmLabel={pending.confirmLabel}
          error={task.error}
          busy={task.busy}
          message={pending.message}
          onCancel={() => setPending(undefined)}
          onConfirm={() => execute(pending)}
        />
      )}
      {edit && (
        <Confirm
          title={edit === 'name' ? '修改群聊名称' : '编辑群公告'}
          message=''
          confirmLabel='确定'
          danger={false}
          busy={task.busy}
          error={task.error}
          onCancel={() => setEdit(undefined)}
          onConfirm={() => {
            void run(async current => {
              if (edit === 'name' && !draft.trim())
                throw new Error('请输入群名称')
              await checkGroupManagement(groupID, userID, current, 'manage')
              if (!current())
                return
              const latest = await directory.group(groupID)
              if (!current())
                return
              if (!latest)
                throw new Error('群组不存在或无法访问')
              await directory.update(
                groupID,
                edit === 'name' ? draft.trim() : latest.groupName,
                edit === 'notice' ? draft : latest.notification || ''
              )
              if (current()) {
                setEdit(undefined)
                await reload(current)
                setNotice('群资料已更新')
              }
            })
          }}
        >
          <ProductPromptField
            placeholder={edit === 'name' ? '群名称' : '写点什么让大家知道'}
            value={draft}
            onChangeText={setDraft}
            multiline={edit === 'notice'}
            editable={!task.busy}
          />
        </Confirm>
      )}
      {exit && (
        <Confirm
          title={groupPermissions(self).dismiss ? '解散群组？' : '退出群组？'}
          confirmLabel={groupPermissions(self).dismiss ? '解散' : '退出'}
          error={task.error}
          busy={task.busy}
          message={
            groupPermissions(self).dismiss
              ? '解散后所有成员将失去此群组，且无法恢复。'
              : '退出后将不再接收此群的消息。'
          }
          onCancel={() => setExit(false)}
          onConfirm={() => {
            void run(async current => {
              const latest = await directory.member(groupID, userID)
              if (!current())
                return
              const p = groupPermissions(latest)
              if (
                (groupPermissions(self).dismiss && !p.dismiss) ||
                (!groupPermissions(self).dismiss && !p.leave)
              )
                throw new Error('群成员或权限已变化，请刷新后重试')
              if (p.dismiss)
                await directory.dismiss(groupID)
              else
                await directory.leave(groupID)
              if (current()) {
                setNotice(p.dismiss ? '已解散群组' : '已退出群组')
                router.replace('/(tabs)/contacts' as Href)
              }
            })
          }}
        />
      )}
    </ProductPage>
  )
}
