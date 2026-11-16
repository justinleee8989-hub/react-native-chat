import React, { useCallback, useEffect, useState } from 'react'
import { directory } from '../application/directory'
import {
  checkGroupManagement,
  groupApplicationEvents,
  groupManagement,
} from '../application/group-management'
import { useOpenIM } from '../application/store'
import LoginScreen from '../auth/LoginScreen'
import { mergeDirectory } from '../domain/directory'
import { groupManagementPermissions, type GroupApplication } from '../domain/group-management'
import { Action, Confirm, Field, Label, Page, PersonRow } from '../shared/shared'
import { useDirectoryEvents } from '../shared/useDirectoryEvents'
import { useTask } from '../shared/useTask'

export default function GroupRequestsScreen() {
  const { session } = useOpenIM()
  return session ? (
    <Requests key={`${session.userID}:${session.imToken}`} userID={session.userID} />
  ) : (
    <LoginScreen />
  )
}
function Requests({ userID }: { userID: string }) {
  const [received, setReceived] = useState(true)
  return (
    <RequestList
      key={String(received)}
      received={received}
      userID={userID}
      switchList={() => setReceived(!received)}
    />
  )
}
function RequestList({
  received,
  userID,
  switchList,
}: {
  received: boolean
  userID: string
  switchList: () => void
}) {
  const task = useTask()
  const { run } = task
  const [items, setItems] = useState<GroupApplication[]>([])
  const [allowed, setAllowed] = useState<string[]>([])
  const [offset, setOffset] = useState(0)
  const [more, setMore] = useState(false)
  const [message, setMessage] = useState('')
  const [notice, setNotice] = useState('')
  const [confirm, setConfirm] = useState<{ item: GroupApplication, accept: boolean }>()
  const load = useCallback(
    async (current: () => boolean, offset = 0) => {
      const page = await groupManagement.requests(received, offset)
      if (!current()) 
        return
      const groups = [...new Set(page.map(item => item.groupID))]
      const permissions = received
        ? await Promise.all(
          groups.map(async groupID => {
            const self = await directory.member(groupID, userID)
            return groupManagementPermissions(self).manage ? groupID : ''
          })
        )
        : []
      if (current()) {
        setItems(items =>
          offset ? mergeDirectory(items, page, item => `${item.groupID}:${item.userID}`) : page
        )
        setAllowed(items => (offset ? [...new Set([...items, ...permissions])] : permissions))
        setOffset(offset + page.length)
        setMore(page.length === 30)
      }
    },
    [received, userID]
  )
  const refresh = useCallback(() => run(current => load(current)), [run, load])
  useEffect(() => {
    void refresh()
  }, [refresh])
  useDirectoryEvents(groupApplicationEvents, refresh, task.busy)
  return (
    <Page title={received ? '收到的入群申请' : '发出的入群申请'} {...task}>
      <Action
        title={received ? '查看我发出的申请' : '查看收到的申请'}
        disabled={task.busy}
        onPress={switchList}
      />
      <Action
        title='刷新申请'
        disabled={task.busy}
        onPress={() => {
          void refresh()
        }}
      />
      {!!notice && <Label>{notice}</Label>}
      {!items.length && !task.busy && <Label>暂无入群申请</Label>}
      {items.map(item => (
        <PersonRow
          key={`${item.groupID}:${item.userID}`}
          person={{ userID: item.userID, nickname: item.nickname, faceURL: item.userFaceURL }}
        >
          <Label>
            {item.groupName || item.groupID} ·{' '}
            {item.handleResult === 0 ? '待审核' : item.handleResult === 1 ? '已同意' : '已拒绝'}
          </Label>
          <Label>{item.reqMsg || '未填写申请理由'}</Label>
          {!!item.handledMsg && <Label>处理说明：{item.handledMsg}</Label>}
          {received && item.handleResult === 0 && allowed.includes(item.groupID) && (
            <>
              <Action
                title='同意'
                disabled={task.busy}
                onPress={() => {
                  setMessage('')
                  setConfirm({ item, accept: true })
                }}
              />
              <Action
                title='拒绝'
                danger
                disabled={task.busy}
                onPress={() => {
                  setMessage('')
                  setConfirm({ item, accept: false })
                }}
              />
            </>
          )}
        </PersonRow>
      ))}
      {more && (
        <Action
          title='加载更多申请'
          disabled={task.busy}
          onPress={() => {
            void run(current => load(current, offset))
          }}
        />
      )}
      {confirm && (
        <>
          <Field value={message} onChangeText={setMessage} placeholder='处理说明（选填）' />
          <Confirm error={task.error}
            busy={task.busy}
            message={`${confirm.accept ? '同意' : '拒绝'} ${confirm.item.nickname || confirm.item.userID} 加入 ${confirm.item.groupName || confirm.item.groupID}？`}
            onCancel={() => setConfirm(undefined)}
            onConfirm={() => {
              void run(async current => {
                await checkGroupManagement(confirm.item.groupID, userID, current, 'manage')
                if (!current()) 
                  return
                await groupManagement.respond(
                  confirm.item.groupID,
                  confirm.item.userID,
                  confirm.accept,
                  message
                )
                if (!current()) 
                  return
                setConfirm(undefined)
                setNotice('申请已处理')
                await load(current)
              })
            }}
          />
        </>
      )}
    </Page>
  )
}
