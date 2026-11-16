import React, { useCallback, useEffect, useState } from 'react'
import { Href, useLocalSearchParams, useRouter } from 'expo-router'
import { directory , groupDirectoryEvents } from '@/features/im/application/directory'
import { openConversation, useOpenIM } from '@/features/im/application/store'
import LoginScreen from '@/features/im/auth/LoginScreen'
import {
  canRemoveMember,
  groupPermissions,
  mergeDirectory,
  type Group,
  type Person,
} from '@/features/im/domain/directory'
import { useTask } from '@/features/im/shared/useTask'
import { FriendPicker } from '../shared/FriendPicker'
import { Action, Confirm, Field, Label, Page, PersonRow } from '../shared/shared'
import { useDirectoryEvents } from '../shared/useDirectoryEvents'

export default function GroupScreen() {
  const { session } = useOpenIM()
  const { id } = useLocalSearchParams<{ id: string }>()
  return session ? (
    <GroupDetails key={`${session.userID}:${id}`} groupID={id} userID={session.userID} />
  ) : (
    <LoginScreen />
  )
}
function GroupDetails({ groupID, userID }: { groupID: string, userID: string }) {
  const router = useRouter()
  const task = useTask()
  const { run } = task
  const [group, setGroup] = useState<Group>()
  const [self, setSelf] = useState<Person>()
  const [members, setMembers] = useState<Person[]>([])
  const [offset, setOffset] = useState(0)
  const [more, setMore] = useState(false)
  const [name, setName] = useState('')
  const [notification, setNotification] = useState('')
  const [invite, setInvite] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const [notice, setNotice] = useState('')
  const [confirm, setConfirm] = useState<{
    message: string
    action: () => Promise<unknown>
    exit?: boolean
  }>()
  const permissions = groupPermissions(self, group?.needVerification)
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
      setOffset(people.length)
      setMore(people.length === 30)
      setName(info.groupName)
      setNotification(info.notification || '')
    },
    [groupID, userID]
  )
  const refresh = useCallback(() => run(reload), [run, reload])
  useDirectoryEvents(groupDirectoryEvents, refresh, task.busy, groupID)
  useEffect(() => {
    void run(reload)
  }, [run, reload])
  return (
    <Page title={group?.groupName || '群详情'} {...task}>
      <Action
        title='刷新群资料'
        disabled={task.busy}
        onPress={() => {
          void run(reload)
        }}
      />
      {!!notice && <Label>{notice}</Label>}
      {group && (
        <>
          <Label>群 ID：{groupID}</Label>
          <Label>
            成员：{group.memberCount || members.length} 人 ·{' '}
            {self?.roleLevel === 100
              ? '群主'
              : self?.roleLevel === 60
                ? '管理员'
                : self
                  ? '群成员'
                  : '未加入'}
          </Label>
          {self && (
            <Action
              title='进入群聊'
              disabled={task.busy}
              onPress={() => {
                void run(async current => {
                  const id = await openConversation(groupID, 3)
                  if (current()) 
                    router.push(`/chats/${encodeURIComponent(id)}` as Href)
                })
              }}
            />
          )}
          <Label>群公告</Label>
          <Label>{group.notification || '暂无群公告'}</Label>
          {permissions.manage && (
            <>
              <Field value={name} onChangeText={setName} placeholder='群名称' />
              <Field value={notification} onChangeText={setNotification} placeholder='群公告' />
              <Action
                title='保存群资料'
                disabled={task.busy || !name.trim()}
                onPress={() => {
                  void run(async current => {
                    await directory.update(groupID, name.trim(), notification)
                    if (current()) {
                      setGroup(info =>
                        info ? { ...info, groupName: name.trim(), notification } : info
                      )
                      setNotice('群资料已更新')
                    }
                  })
                }}
              />
            </>
          )}
          {permissions.invite && (
            <Action
              title={
                invite
                  ? '收起邀请'
                  : permissions.inviteNeedsApproval
                    ? '申请邀请好友入群'
                    : '邀请好友入群'
              }
              disabled={task.busy}
              onPress={() => setInvite(!invite)}
            />
          )}
          {invite && permissions.invite && (
            <>
              <FriendPicker
                excluded={members.map(member => member.userID)}
                selected={selected}
                onChange={setSelected}
                disabled={task.busy}
              />
              <Action
                title={permissions.inviteNeedsApproval ? '提交邀请申请' : '邀请所选好友'}
                disabled={task.busy || !selected.length}
                onPress={() => {
                  void run(async current => {
                    await directory.invite(groupID, selected)
                    if (current()) {
                      setInvite(false)
                      setSelected([])
                      setNotice(
                        permissions.inviteNeedsApproval
                          ? '邀请申请已提交，等待群主或管理员审核'
                          : '邀请已提交，成员列表将在同步后更新'
                      )
                    }
                  })
                }}
              />
            </>
          )}
          {permissions.manage && (
            <Action
              title='群权限与禁言'
              onPress={() =>
                router.push(`/chats/groups/manage?id=${encodeURIComponent(groupID)}` as Href)
              }
            />
          )}
          <Label>群成员</Label>
          {members.map(member => (
            <PersonRow key={member.userID} person={member}>
              <Label>
                {member.roleLevel === 100 ? '群主' : member.roleLevel === 60 ? '管理员' : '成员'}
              </Label>
              {canRemoveMember(self, member) && (
                <Action
                  title='移出群组'
                  danger
                  disabled={task.busy}
                  onPress={() =>
                    setConfirm({
                      message: `将 ${member.nickname || member.userID} 移出群组？`,
                      action: () => directory.kick(groupID, member.userID),
                    })
                  }
                />
              )}
            </PersonRow>
          ))}
          {more && (
            <Action
              title='加载更多成员'
              disabled={task.busy}
              onPress={() => {
                void run(async current => {
                  const page = await directory.members(groupID, offset)
                  if (current()) {
                    setMembers(items => mergeDirectory(items, page, item => item.userID))
                    setOffset(offset + page.length)
                    setMore(page.length === 30)
                  }
                })
              }}
            />
          )}
          {permissions.leave && (
            <Action
              title='退出群组'
              danger
              disabled={task.busy}
              onPress={() =>
                setConfirm({
                  message: '确认退出该群组？',
                  action: () => directory.leave(groupID),
                  exit: true,
                })
              }
            />
          )}
          {permissions.dismiss && (
            <Action
              title='解散群组'
              danger
              disabled={task.busy}
              onPress={() =>
                setConfirm({
                  message: '解散后所有成员将失去此群组，确认解散？',
                  action: () => directory.dismiss(groupID),
                  exit: true,
                })
              }
            />
          )}
        </>
      )}
      {confirm && (
        <Confirm error={task.error}
          message={confirm.message}
          busy={task.busy}
          onCancel={() => setConfirm(undefined)}
          onConfirm={() => {
            void run(async current => {
              await confirm.action()
              if (!current()) 
                return
              setConfirm(undefined)
              if (confirm.exit) 
                router.replace('/chats/groups' as Href)
              else 
                setNotice('操作已提交，成员列表将在同步后更新')
            })
          }}
        />
      )}
    </Page>
  )
}
