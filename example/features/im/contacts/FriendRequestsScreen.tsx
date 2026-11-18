import React, { useCallback, useEffect, useState } from 'react'
import { Text, View } from 'react-native'
import { type Href, useRouter } from 'expo-router'
import { directory, contactDirectoryEvents } from '../application/directory'
import { useOpenIM } from '../application/store'
import LoginScreen from '../auth/LoginScreen'
import { mergeDirectory, type FriendRequest } from '../domain/directory'
import { showProductToast } from '../shared/ProductToast'
import { Action } from '../shared/shared'
import { useDirectoryEvents } from '../shared/useDirectoryEvents'
import { useTask } from '../shared/useTask'
import { ProductAvatar, ProductListRow, ProductButton, ProductSegment } from '../ui/primitives'
import { ProductEmpty } from '../ui/ProductPage'
import { ProductSkeleton } from '../ui/ProductSkeleton'
import { useProductTheme } from '../ui/theme'
import { ContactIconButton, ContactLayout } from './ContactLayout'

export default function FriendRequestsScreen () {
  const { session } = useOpenIM()
  return session ? <Requests key={`${session.userID}:${session.imToken}`} /> : <LoginScreen />
}
function Requests () {
  const router = useRouter()
  const t = useProductTheme()
  const task = useTask()
  const { run } = task
  const [received, setReceived] = useState(true)
  const [requests, setRequests] = useState<FriendRequest[]>([])
  const [offset, setOffset] = useState(0)
  const [more, setMore] = useState(false)
  const setNotice = showProductToast
  const refresh = useCallback(
    () =>
      run(async current => {
        const page = await directory.requests(received)
        if (current()) {
          setRequests(page)
          setOffset(page.length)
          setMore(page.length === 30)
        }
      }),
    [received, run]
  )
  useDirectoryEvents(contactDirectoryEvents, refresh, task.busy)
  useEffect(() => {
    void refresh()
  }, [refresh])
  const respond = (id: string, accept: boolean) => {
    void run(async current => {
      await directory.respond(id, accept)
      if (current()) {
        setRequests(items =>
          items.map(item =>
            item.fromUserID === id ? { ...item, handleResult: accept ? 1 : -1 } : item
          )
        )
        setNotice(accept ? '已接受好友申请' : '已拒绝好友申请')
      }
    })
  }
  return (
    <ContactLayout
      white
      title='新的朋友'
      {...task}
      loading={!task.hasSucceeded}
      right={
        <ContactIconButton
          name='userPlus'
          label='添加好友'
          onPress={() => router.push('/chats/add-friend' as Href)}
        />
      }
      headerContent={
        <ProductSegment
          options={[
            { value: 'in', label: '收到的申请' },
            { value: 'out', label: '发出的申请' },
          ]}
          value={received ? 'in' : 'out'}
          onChange={value => {
            if (!task.busy && (value === 'in') !== received) {
              setRequests([])
              setNotice('')
              setReceived(value === 'in')
            }
          }}
        />
      }
    >
      {requests.map((request, index) => {
        const id = received ? request.fromUserID : request.toUserID
        const name = (received ? request.fromNickname : request.toNickname) || id
        return (
          <ProductListRow
            trailingInteractive={received && request.handleResult === 0}
            small
            last={index === requests.length - 1}
            key={`${request.fromUserID}:${request.toUserID}`}
            title={name}
            subtitle={request.reqMsg || '好友申请'}
            leading={<ProductAvatar id={id} title={name} size={44} />}
            onPress={() => router.push(`/chats/people/${encodeURIComponent(id)}` as Href)}
            trailing={
              received && request.handleResult === 0 ? (
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <ProductButton
                    compact
                    variant='gray'
                    title='拒绝'
                    disabled={task.busy}
                    onPress={() => respond(id, false)}
                  />
                  <ProductButton
                    compact
                    title='接受'
                    disabled={task.busy}
                    onPress={() => respond(id, true)}
                  />
                </View>
              ) : (
                <Text style={{ fontSize: 13, color: t.text3 }}>
                  {request.handleResult === 0
                    ? '待处理'
                    : request.handleResult === 1
                      ? '已通过'
                      : '已拒绝'}
                </Text>
              )
            }
          />
        )
      })}
      {/* The segment above is there from the first frame; only the rows wait. */}
      {!task.hasSucceeded && !task.error && <ProductSkeleton kind='list' small />}
      {task.hasSucceeded && !requests.length && !task.busy && <ProductEmpty title='暂无申请' />}
      {!!task.error && (
        <Action
          title='重新加载'
          disabled={task.busy}
          onPress={() => {
            void refresh()
          }}
        />
      )}
      {more && (
        <Action
          title='加载更多申请'
          disabled={task.busy}
          onPress={() => {
            void run(async current => {
              const page = await directory.requests(received, offset)
              if (current()) {
                setRequests(items =>
                  mergeDirectory(items, page, item => `${item.fromUserID}:${item.toUserID}`)
                )
                setOffset(offset + page.length)
                setMore(page.length === 30)
              }
            })
          }}
        />
      )}
    </ContactLayout>
  )
}
