import React, { useCallback, useEffect, useState } from 'react'
import { View } from 'react-native'
import { Href, useRouter } from 'expo-router'
import { directory , contactDirectoryEvents } from '@/features/im/application/directory'
import { openConversation, useOpenIM } from '@/features/im/application/store'
import LoginScreen from '@/features/im/auth/LoginScreen'
import { mergeDirectory, type Person, type FriendRequest } from '@/features/im/domain/directory'
import { useTask } from '@/features/im/shared/useTask'
import { Action, Confirm, Field, Label, Page, PersonRow, styles } from '../shared/shared'
import { useDirectoryEvents } from '../shared/useDirectoryEvents'

export default function ContactsScreen ({ root = false }: { root?: boolean }) {
  const { session } = useOpenIM()
  return session ? <Contacts root={root} key={`${session.userID}:${session.imToken}`} userID={session.userID} /> : <LoginScreen />
}
function Contacts ({ userID, root }: { userID: string, root: boolean }) {
  const router = useRouter()
  const task = useTask()
  const { run } = task
  const [friends, setFriends] = useState<Person[]>([])
  const [requests, setRequests] = useState<FriendRequest[]>([])
  const [received, setReceived] = useState(true)
  const [requestOffset, setRequestOffset] = useState(0)
  const [friendOffset, setFriendOffset] = useState(0)
  const [moreFriends, setMoreFriends] = useState(false)
  const [moreRequests, setMoreRequests] = useState(false)
  const [query, setQuery] = useState('')
  const [message, setMessage] = useState('你好，希望添加你为好友')
  const [results, setResults] = useState<Person[]>([])
  const [searched, setSearched] = useState(false)
  const [notice, setNotice] = useState('')
  const [remove, setRemove] = useState<Person>()
  const refresh = useCallback(
    () =>
      run(async current => {
        const [people, incoming] = await Promise.all([
          directory.friends(),
          directory.requests(received),
        ])
        if (!current())
          return
        setFriends(people)
        setFriendOffset(people.length)
        setMoreFriends(people.length === 30)
        setRequests(incoming)
        setRequestOffset(incoming.length)
        setMoreRequests(incoming.length === 30)
      }),
    [received, run]
  )
  useDirectoryEvents(contactDirectoryEvents, refresh, task.busy)
  useEffect(() => {
    void refresh()
  }, [refresh])
  const respond = (id: string, accept: boolean) =>
    void run(async current => {
      await directory.respond(id, accept)
      if (!current())
        return
      setRequests(items =>
        items.map(item =>
          item.fromUserID === id ? { ...item, handleResult: accept ? 1 : -1 } : item
        )
      )
      setNotice(accept ? '已接受好友申请，好友列表将在同步后更新' : '已拒绝好友申请')
    })
  return (
    <Page root={root} title='通讯录' {...task}>
      <Action
        title='刷新'
        disabled={task.busy}
        onPress={() => {
          void refresh()
        }}
      />
      <Label>查找用户</Label>
      <Field value={query} onChangeText={setQuery} placeholder='完整用户 ID' />
      <Action
        title='查找'
        disabled={task.busy || !query.trim() || query.trim() === userID}
        onPress={() => {
          void run(async current => {
            const people = await directory.users(query.trim())
            if (current()) {
              setResults(people)
              setSearched(true)
              setNotice('')
            }
          })
        }}
      />
      {searched && !results.length && <Label>未找到该用户</Label>}
      {!!results.length && (
        <Field value={message} onChangeText={setMessage} placeholder='好友申请说明' />
      )}
      {results.map(person => (
        <PersonRow key={person.userID} person={person}>
          <Action
            title='发送好友申请'
            disabled={
              task.busy ||
              person.userID === userID ||
              friends.some(item => item.userID === person.userID)
            }
            onPress={() => {
              void run(async current => {
                await directory.add(person.userID, message)
                if (current())
                  setNotice('好友申请已发送')
              })
            }}
          />
        </PersonRow>
      ))}
      {!!notice && <Label>{notice}</Label>}
      <Label>我的好友 · {friends.length}</Label>
      {!friends.length && !task.busy && <Label>暂无好友</Label>}
      {friends.map(person => (
        <PersonRow key={person.userID} person={person}>
          <Action
            title='发消息'
            disabled={task.busy}
            onPress={() => {
              void run(async current => {
                const id = await openConversation(person.userID)
                if (current())
                  router.push(`/chats/${encodeURIComponent(id)}` as Href)
              })
            }}
          />
          <Action title='查看资料' disabled={task.busy} onPress={() => router.push(`/chats/people/${encodeURIComponent(person.userID)}` as Href)} />
          <Action title='删除好友' danger disabled={task.busy} onPress={() => setRemove(person)} />
        </PersonRow>
      ))}
      {remove && (
        <Confirm error={task.error}
          message={`删除好友 ${remove.nickname || remove.userID}？`}
          busy={task.busy}
          onCancel={() => setRemove(undefined)}
          onConfirm={() => {
            void run(async current => {
              await directory.removeFriend(remove.userID)
              if (current()) {
                setFriends(items => items.filter(item => item.userID !== remove.userID))
                setRemove(undefined)
                setFriendOffset(offset => Math.max(0, offset - 1))
              }
            })
          }}
        />
      )}
      {moreFriends && (
        <Action
          title='加载更多好友'
          disabled={task.busy}
          onPress={() => {
            void run(async current => {
              const page = await directory.friends(friendOffset)
              if (current()) {
                setFriends(items => mergeDirectory(items, page, item => item.userID))
                setFriendOffset(friendOffset + page.length)
                setMoreFriends(page.length === 30)
              }
            })
          }}
        />
      )}
      <Label>好友申请</Label>
      <View style={styles.actions}>
        <Action
          title={received ? '✓ 收到的申请' : '收到的申请'}
          disabled={task.busy}
          onPress={() => setReceived(true)}
        />
        <Action
          title={!received ? '✓ 发出的申请' : '发出的申请'}
          disabled={task.busy}
          onPress={() => setReceived(false)}
        />
      </View>
      {!requests.length && !task.busy && <Label>暂无申请</Label>}
      {requests.map(request => (
        <PersonRow
          key={`${request.fromUserID}:${request.toUserID}`}
          person={{
            userID: received ? request.fromUserID : request.toUserID,
            nickname: received ? request.fromNickname : request.toNickname,
          }}
        >
          <Label>
            {request.reqMsg || '好友申请'} ·{' '}
            {request.handleResult === 0
              ? '待处理'
              : request.handleResult === 1
                ? '已通过'
                : '已拒绝'}
          </Label>
          {received && request.handleResult === 0 && (
            <>
              <Action
                title='接受'
                disabled={task.busy}
                onPress={() => respond(request.fromUserID, true)}
              />
              <Action
                title='拒绝'
                disabled={task.busy}
                onPress={() => respond(request.fromUserID, false)}
              />
            </>
          )}
        </PersonRow>
      ))}
      {moreRequests && (
        <Action
          title='加载更多申请'
          disabled={task.busy}
          onPress={() => {
            void run(async current => {
              const page = await directory.requests(received, requestOffset)
              if (current()) {
                setRequests(items =>
                  mergeDirectory(items, page, item => `${item.fromUserID}:${item.toUserID}`)
                )
                setRequestOffset(requestOffset + page.length)
                setMoreRequests(page.length === 30)
              }
            })
          }}
        />
      )}
    </Page>
  )
}
