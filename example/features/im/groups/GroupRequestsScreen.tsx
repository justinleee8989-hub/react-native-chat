import React, { useCallback, useEffect, useState } from 'react'
import { Text, View } from 'react-native'
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
import { showProductToast } from '../shared/ProductToast'
import { Action } from '../shared/shared'
import { useDirectoryEvents } from '../shared/useDirectoryEvents'
import { useTask } from '../shared/useTask'
import { ProductAvatar, ProductListRow, ProductButton, ProductSegment } from '../ui/primitives'
import { ProductPage, ProductEmpty } from '../ui/ProductPage'
import { ProductSkeleton } from '../ui/ProductSkeleton'
import { useProductTheme } from '../ui/theme'
import { GroupAvatar } from './group-ui'

export default function GroupRequestsScreen () {
  const { session } = useOpenIM()
  return session ? (
    <Requests key={`${session.userID}:${session.imToken}`} userID={session.userID} />
  ) : (
    <LoginScreen />
  )
}
function Requests ({ userID }: { userID: string }) {
  const [received, setReceived] = useState(true)
  return (
    <RequestList
      key={String(received)}
      received={received}
      userID={userID}
      switchList={setReceived}
    />
  )
}
function RequestList ({
  received,
  userID,
  switchList,
}: {
  received: boolean
  userID: string
  switchList: (received: boolean) => void
}) {
  const t = useProductTheme()
  const task = useTask()
  const { run } = task
  const [items, setItems] = useState<GroupApplication[]>([])
  const [allowed, setAllowed] = useState<string[]>([])
  const [offset, setOffset] = useState(0)
  const [more, setMore] = useState(false)
  const setNotice = showProductToast
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
  const respond = (item: GroupApplication, accept: boolean) => {
    void run(async current => {
      await checkGroupManagement(item.groupID, userID, current, 'manage')
      if (!current())
        return
      await groupManagement.respond(item.groupID, item.userID, accept, '')
      if (!current())
        return
      setNotice('申请已处理')
      await load(current)
    })
  }
  return (
    <ProductPage
      white
      title='入群申请'
      {...task}
      loading={!task.hasSucceeded}
      onRetry={() => {
        void refresh()
      }}
      headerContent={
        <ProductSegment
          options={[
            { value: 'in', label: '收到的申请' },
            { value: 'out', label: '发出的申请' },
          ]}
          value={received ? 'in' : 'out'}
          onChange={value => {
            if (!task.busy)
              switchList(value === 'in')
          }}
        />
      }
    >
      {/* The segment above is there from the first frame; only the rows wait. */}
      {!task.hasSucceeded && !task.error && <ProductSkeleton kind='list' small />}
      {task.hasSucceeded && !items.length && !task.busy && <ProductEmpty title='暂无入群申请' />}
      {items.map((item, index) => (
        <ProductListRow
          small
          last={index === items.length - 1}
          key={`${item.groupID}:${item.userID}`}
          title={received ? item.nickname || item.userID : item.groupName || item.groupID}
          subtitle={`${received ? `申请加入 ${item.groupName || item.groupID} · ` : ''}${item.reqMsg || '未填写申请理由'}${item.handledMsg ? ` · 处理说明：${item.handledMsg}` : ''}`}
          leading={
            received ? (
              <ProductAvatar
                id={item.userID}
                title={item.nickname || item.userID}
                uri={item.userFaceURL}
                size={44}
              />
            ) : (
              <GroupAvatar
                group={{ groupID: item.groupID, groupName: item.groupName || item.groupID }}
                size={44}
              />
            )
          }
          trailing={
            received && item.handleResult === 0 && allowed.includes(item.groupID) ? (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <ProductButton
                  compact
                  variant='gray'
                  title='拒绝'
                  disabled={task.busy}
                  onPress={() => respond(item, false)}
                />
                <ProductButton
                  compact
                  title='同意'
                  disabled={task.busy}
                  onPress={() => respond(item, true)}
                />
              </View>
            ) : (
              <Text style={{ fontSize: 13, color: t.text3 }}>
                {item.handleResult === 0 ? '待处理' : item.handleResult === 1 ? '已通过' : '已拒绝'}
              </Text>
            )
          }
        />
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
    </ProductPage>
  )
}
