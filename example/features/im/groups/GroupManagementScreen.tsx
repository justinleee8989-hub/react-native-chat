import React, { useCallback, useEffect, useState } from 'react'
import { useLocalSearchParams } from 'expo-router'
import { directory, groupDirectoryEvents } from '../application/directory'
import { checkGroupManagement, groupManagement } from '../application/group-management'
import { useOpenIM } from '../application/store'
import LoginScreen from '../auth/LoginScreen'
import { mergeDirectory, type Person, type Group } from '../domain/directory'
import { groupManagementPermissions, groupMuteLabel, memberMuteLabel } from '../domain/group-management'
import { Action, Confirm, Label, Page, PersonRow } from '../shared/shared'
import { useDirectoryEvents } from '../shared/useDirectoryEvents'
import { useTask } from '../shared/useTask'

type Pending = {
  message: string
  permission: 'manage' | 'role' | 'transfer' | 'muteMember'
  targetID?: string
  action: () => Promise<unknown>
}
export default function GroupManagementScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { session } = useOpenIM()
  return session ? (
    <Management
      key={`${session.userID}:${session.imToken}:${id}`}
      groupID={id}
      userID={session.userID}
    />
  ) : (
    <LoginScreen />
  )
}
function Management({ groupID, userID }: { groupID: string, userID: string }) {
  const task = useTask()
  const { run } = task
  const [group, setGroup] = useState<Group>()
  const [self, setSelf] = useState<Person>()
  const [members, setMembers] = useState<Person[]>([])
  const [offset, setOffset] = useState(0)
  const [more, setMore] = useState(false)
  const [notice, setNotice] = useState('')
  const [pending, setPending] = useState<Pending>()
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
  return (
    <Page title='群权限与禁言' {...task}>
      <Action
        title='刷新成员与权限'
        disabled={task.busy}
        onPress={() => {
          void refresh()
        }}
      />
      {!!notice && <Label>{notice}</Label>}
      <Label>{groupMuteLabel(group?.status)}</Label>
      {groupManagementPermissions(self).manage ? (
        <>
          <Label>全员禁言对普通成员生效，群主和管理员仍可发言。</Label>
          <Action
            title='开启全员禁言'
            disabled={task.busy}
            onPress={() =>
              setPending({
                message: '确认开启全员禁言？',
                permission: 'manage',
                action: () => groupManagement.muteGroup(groupID, true),
              })
            }
          />
          <Action
            title='解除全员禁言'
            disabled={task.busy}
            onPress={() =>
              setPending({
                message: '确认解除全员禁言？',
                permission: 'manage',
                action: () => groupManagement.muteGroup(groupID, false),
              })
            }
          />
        </>
      ) : (
        <Label>仅群主或管理员可管理禁言；仅群主可设置管理员和转让群主。</Label>
      )}
      {members.map(member => {
        const permissions = groupManagementPermissions(self, member)
        const name = member.nickname || member.userID
        return (
          <PersonRow key={member.userID} person={member}>
            <Label>
              {member.roleLevel === 100 ? '群主' : member.roleLevel === 60 ? '管理员' : '成员'}
            </Label>
            <Label>{memberMuteLabel(member.muteEndTime)}</Label>
            {permissions.role && (
              <Action
                title={member.roleLevel === 60 ? '取消管理员' : '设为管理员'}
                disabled={task.busy}
                onPress={() =>
                  setPending({
                    message: `确认${member.roleLevel === 60 ? '取消' : '设置'} ${name} 的管理员身份？`,
                    permission: 'role',
                    targetID: member.userID,
                    action: () =>
                      groupManagement.role(groupID, member.userID, member.roleLevel !== 60),
                  })
                }
              />
            )}
            {permissions.transfer && (
              <Action
                title='转让群主'
                danger
                disabled={task.busy}
                onPress={() =>
                  setPending({
                    message: `将群主转让给 ${name}？你将失去群主权限。`,
                    permission: 'transfer',
                    targetID: member.userID,
                    action: () => groupManagement.transfer(groupID, member.userID),
                  })
                }
              />
            )}
            {permissions.muteMember && (
              <>
                <Action
                  title='禁言 1 小时'
                  disabled={task.busy}
                  onPress={() =>
                    setPending({
                      message: `将 ${name} 禁言 1 小时？`,
                      permission: 'muteMember',
                      targetID: member.userID,
                      action: () => groupManagement.muteMember(groupID, member.userID, 3600),
                    })
                  }
                />
                <Action
                  title='解除成员禁言'
                  disabled={task.busy}
                  onPress={() =>
                    setPending({
                      message: `解除 ${name} 的成员禁言？全员禁言设置仍会生效。`,
                      permission: 'muteMember',
                      targetID: member.userID,
                      action: () => groupManagement.muteMember(groupID, member.userID, 0),
                    })
                  }
                />
              </>
            )}
          </PersonRow>
        )
      })}
      {more && (
        <Action
          title='加载更多成员'
          disabled={task.busy}
          onPress={() => {
            void run(current => reload(current, offset))
          }}
        />
      )}
      {pending && (
        <Confirm error={task.error}
          busy={task.busy}
          message={pending.message}
          onCancel={() => setPending(undefined)}
          onConfirm={() => {
            void run(async current => {
              await checkGroupManagement(
                groupID,
                userID,
                current,
                pending.permission,
                pending.targetID
              )
              if (!current()) 
                return
              await pending.action()
              if (!current()) 
                return
              setPending(undefined)
              setNotice('操作已提交，正在刷新群状态')
              await reload(current)
              if (current())
                setNotice('操作成功，已刷新群状态')
            })
          }}
        />
      )}
    </Page>
  )
}
