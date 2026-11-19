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
import { useT } from '../i18n'
import { ProductError } from '../shared/product-error'
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
  const tr = useT()
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
      setNotice(tr('manage.done'))
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
          title: tr('manage.viewProfile'),
          onPress: () => {
            setSelected(undefined)
            router.push(`/chats/people/${encodeURIComponent(selected.userID)}` as Href)
          },
        },
        ...(permissions.role
          ? [
            {
              title: selected.roleLevel === 60 ? tr('manage.removeAdmin') : tr('manage.makeAdmin'),
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
              title: tr('manage.transferOwner'),
              onPress: () =>
                setPending({
                  ...operation('transfer', () =>
                    groupManagement.transfer(groupID, selected.userID)
                  ),
                  title: tr('manage.transferTitle', { name }),
                  message: tr('manage.transferMessage'),
                  confirmLabel: tr('manage.transfer'),
                }),
            },
          ]
          : []),
        ...(permissions.muteMember
          ? [
            {
              title: muted ? tr('manage.unmute') : tr('manage.muteHour'),
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
              title: tr('manage.remove'),
              danger: true,
              onPress: () =>
                setPending({
                  ...operation('muteMember', () => directory.kick(groupID, selected.userID)),
                  title: tr('manage.removeTitle', { name }),
                  message: '',
                  confirmLabel: tr('manage.removeConfirm'),
                }),
            },
          ]
          : []),
      ]
    })()
    : []
  return (
    <ProductPage
      title={membersPage ? (managesMembers ? tr('manage.membersAdmin') : tr('manage.members')) : tr('group.manage')}
      subtitle={membersPage ? tr('chatInfo.memberCount', { count: group?.memberCount || members.length }) : undefined}
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
          title={group?.status === 2 ? tr('notice.groupDismissed') : tr('manage.unavailable')}
          subtitle={tr('manage.cantManage')}
        />
      )}
      {!unavailable && !membersPage && group && (
        <>
          {groupManagementPermissions(self).manage && (
            <>
              <ProductSection>{tr('manage.groupProfile')}</ProductSection>
              <ProductInset>
                <ProductCard>
                  <ProductRow
                    title={tr('manage.groupName')}
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
                    title={tr('chatInfo.announcement')}
                    trailing={
                      <Text
                        numberOfLines={1}
                        style={{ color: t.text2, fontSize: 15, maxWidth: '60%' }}
                      >
                        {group.notification || tr('person.notSet')}
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
          <ProductSection>{tr('manage.membersHeading')}</ProductSection>
          <ProductInset>
            <ProductCard>
              {groupPermissions(self, group.needVerification).invite && (
                <ProductRow
                  title={tr('invite.title')}
                  onPress={() =>
                    router.push(`/chats/groups/invite?id=${encodeURIComponent(groupID)}` as Href)
                  }
                />
              )}
              {groupManagementPermissions(self).manage && (
                <ProductRow
                  title={tr('manage.membersAdmin')}
                  trailing={
                    <Text style={{ color: t.text2, fontSize: 15 }}>
                      {tr('chatInfo.memberCount', { count: group.memberCount || members.length })}
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
              <ProductSection>{tr('manage.permissions')}</ProductSection>
              <ProductInset>
                <ProductCard>
                  <ProductRow
                    title={tr('manage.muteAll')}
                    trailing={
                      <ProductSwitch
                        accessibilityLabel={tr('manage.muteAll')}
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
                {tr('manage.muteAllHint')}
                {group.status !== 0 && group.status !== 3 ? ` ${groupMuteLabel(group.status, tr)}` : ''}
              </ProductHint>
            </>
          ) : null}
          {(groupPermissions(self).leave || groupPermissions(self).dismiss) && (
            <>
              <View style={{ height: 24 }} />
              <ProductInset>
                <ProductCard>
                  <ProductRow
                    title={groupPermissions(self).dismiss ? tr('manage.dismiss') : tr('manage.quit')}
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
          {managesMembers && <ProductHint>{tr('manage.memberHint')}</ProductHint>}
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
          error={task.error}
          title={selected.nickname || selected.userID}
          subtitle={
            selected.roleLevel === 100 ? tr('role.owner') : selected.roleLevel === 60 ? tr('role.admin') : tr('role.member')
          }
          busy={task.busy}
          onClose={() => setSelected(undefined)}
          items={memberItems}
        >
        </ProductSheet>
      )}
      {!unavailable && membersPage && more && (
        <Action
          title={tr('manage.loadMore')}
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
          title={edit === 'name' ? tr('manage.editName') : tr('manage.editAnnouncement')}
          message=''
          confirmLabel={tr('common.ok')}
          danger={false}
          busy={task.busy}
          error={task.error}
          onCancel={() => setEdit(undefined)}
          onConfirm={() => {
            void run(async current => {
              if (edit === 'name' && !draft.trim())
                throw new ProductError('manage.enterName')
              await checkGroupManagement(groupID, userID, current, 'manage')
              if (!current())
                return
              const latest = await directory.group(groupID)
              if (!current())
                return
              if (!latest)
                throw new ProductError('group.notFound')
              await directory.update(
                groupID,
                edit === 'name' ? draft.trim() : latest.groupName,
                edit === 'notice' ? draft : latest.notification || ''
              )
              if (current()) {
                setEdit(undefined)
                await reload(current)
                setNotice(tr('notice.groupInfoUpdated'))
              }
            })
          }}
        >
          <ProductPromptField
            placeholder={edit === 'name' ? tr('createGroup.name') : tr('manage.announcementPlaceholder')}
            value={draft}
            onChangeText={setDraft}
            multiline={edit === 'notice'}
            editable={!task.busy}
          />
        </Confirm>
      )}
      {exit && (
        <Confirm
          title={groupPermissions(self).dismiss ? tr('manage.dismissTitle') : tr('manage.quitTitle')}
          confirmLabel={groupPermissions(self).dismiss ? tr('manage.dismissConfirm') : tr('manage.quitConfirm')}
          error={task.error}
          busy={task.busy}
          message={
            groupPermissions(self).dismiss
              ? tr('manage.dismissMessage')
              : tr('manage.quitMessage')
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
                throw new ProductError('group.permissionChanged')
              if (p.dismiss)
                await directory.dismiss(groupID)
              else
                await directory.leave(groupID)
              if (current()) {
                setNotice(p.dismiss ? tr('manage.dismissed') : tr('manage.quitDone'))
                router.replace('/(tabs)/contacts' as Href)
              }
            })
          }}
        />
      )}
    </ProductPage>
  )
}
