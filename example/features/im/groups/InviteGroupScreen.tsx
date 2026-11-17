import React, { useEffect, useState } from 'react'
import { type Href, useLocalSearchParams, useRouter } from 'expo-router'
import { directory } from '../application/directory'
import { useOpenIM } from '../application/store'
import LoginScreen from '../auth/LoginScreen'
import { groupPermissions } from '../domain/directory'
import { FriendPicker } from '../shared/FriendPicker'
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
        throw new Error('群组不存在或无法访问')
      const permissions = groupPermissions(self, group.needVerification)
      if (!permissions.invite)
        throw new Error('当前没有邀请权限')
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
      title='邀请好友入群'
      {...task}
      right={
        <HeaderAction
          title={selected.length ? `邀请(${selected.length})` : '邀请'}
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
                throw new Error('群成员或权限已变化，请刷新后重试')
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
                throw new Error('所选好友已加入群聊，请重新选择')
              await directory.invite(groupID, invitees)
              if (current()) {
                setAllowed(false)
                setSelected([])
                showProductToast(
                  permissions.inviteNeedsApproval
                    ? '邀请申请已提交，等待群主或管理员审核'
                    : '邀请已发送'
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
      {approval && <ProductHint>邀请需经群主或管理员审核。</ProductHint>}
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
