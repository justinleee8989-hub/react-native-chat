import React, { useEffect, useState } from 'react'
import { type Href, useLocalSearchParams, useRouter } from 'expo-router'
import { directory } from '../application/directory'
import { useOpenIM } from '../application/store'
import LoginScreen from '../auth/LoginScreen'
import { groupPermissions } from '../domain/directory'
import { useT } from '../i18n'
import { FriendPicker } from '../shared/FriendPicker'
import { ProductError } from '../shared/product-error'
import { showProductToast } from '../shared/ProductToast'
import { useTask } from '../shared/useTask'
import { ProductPage } from '../ui/ProductPage'
import { HeaderAction, ProductHint } from './group-ui'
export default function InviteGroupScreen () {
  const { session } = useOpenIM()
  const { id } = useLocalSearchParams<{ id: string }>()
  return session ? (
    <Invite
      key={`${session.userID}:${session.imToken}:${id}`}
      groupID={id}
      userID={session.userID}
    />
  ) : (
    <LoginScreen />
  )
}
function Invite ({ groupID, userID }: { groupID: string, userID: string }) {
  const tr = useT()
  const router = useRouter()
  const task = useTask()
  const { run } = task
  const [selected, setSelected] = useState<string[]>([])
  const [excluded, setExcluded] = useState<string[]>([])
  const [allowed, setAllowed] = useState(false)
  const [approval, setApproval] = useState(false)
  useEffect(() => {
    void run(async current => {
      const [group, self] = await Promise.all([
        directory.group(groupID),
        directory.member(groupID, userID),
      ])
      if (!current())
        return
      if (!group)
        throw new ProductError('group.notFound')
      const permissions = groupPermissions(self, group.needVerification)
      if (!permissions.invite)
        throw new ProductError('invite.noPermission')
      const ids: string[] = []
      let offset = 0
      while (current()) {
        const page = await directory.members(groupID, offset)
        ids.push(...page.map(member => member.userID))
        offset += page.length
        if (page.length < 30)
          break
      }
      if (current()) {
        setExcluded(ids)
        setAllowed(true)
        setApproval(permissions.inviteNeedsApproval)
      }
    })
  }, [groupID, userID, run])
  return (
    <ProductPage
      title={tr('invite.title')}
      {...task}
      right={
        <HeaderAction
          title={selected.length ? tr('invite.actionCount', { count: selected.length }) : tr('chatInfo.invite')}
          disabled={!allowed || task.busy || !selected.length}
          onPress={() => {
            void run(async current => {
              const [group, self] = await Promise.all([
                directory.group(groupID),
                directory.member(groupID, userID),
              ])
              if (!current())
                return
              const permissions = groupPermissions(self, group?.needVerification)
              if (!group || !permissions.invite)
                throw new ProductError('group.permissionChanged')
              const memberIDs: string[] = []
              let offset = 0
              while (current()) {
                const page = await directory.members(groupID, offset)
                memberIDs.push(...page.map(member => member.userID))
                offset += page.length
                if (page.length < 30)
                  break
              }
              if (!current())
                return
              const invitees = selected.filter(id => !memberIDs.includes(id))
              setExcluded(memberIDs)
              setSelected(invitees)
              if (!invitees.length)
                throw new ProductError('invite.alreadyMembers')
              await directory.invite(groupID, invitees)
              if (current()) {
                setAllowed(false)
                setSelected([])
                showProductToast(
                  permissions.inviteNeedsApproval
                    ? tr('invite.submitted')
                    : tr('invite.sent')
                )
                if (router.canGoBack())
                  router.back()
                else
                  router.replace(`/chats/groups/${encodeURIComponent(groupID)}` as Href)
              }
            })
          }}
        />
      }
    >
      {approval && <ProductHint>{tr('invite.needsApproval')}</ProductHint>}
      {allowed && (
        <FriendPicker
          inviting
          excluded={excluded}
          selected={selected}
          onChange={setSelected}
          disabled={task.busy}
        />
      )}
    </ProductPage>
  )
}
