import React, { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'expo-router'
import { directory } from '../application/directory'
import { syncMessageReaders, useOpenIM } from '../application/store'
import LoginScreen from '../auth/LoginScreen'
import type { Person } from '../domain/directory'
import { HeaderAction, ProductHint } from '../groups/group-ui'
import { useTask } from '../shared/useTask'
import { ProductSegment, ProductAvatar, ProductListRow } from '../ui/primitives'
import { ProductEmpty, ProductPage } from '../ui/ProductPage'
import { fetchMessageReaders, type ReadersResult } from './readers'

interface Props {
  id: string
  messageID: string
  seq: number
}
export default function MessageReadersScreen (props: Props) {
  const { session } = useOpenIM()
  if (!session)
    return <LoginScreen />
  return (
    <SessionReaders
      key={`${session.userID}:${session.imToken}:${props.id}:${props.messageID}:${props.seq}`}
      {...props}
    />
  )
}
function SessionReaders ({ id, messageID, seq }: Props) {
  const { session, config, conversations } = useOpenIM()
  const groupID = conversations.find(item => item.conversationID === id)?.groupID
  const [roles, setRoles] = useState<Person[]>([])
  const { busy, error, run } = useTask()
  const [result, setResult] = useState<ReadersResult>()
  const [read, setRead] = useState(true)
  const router = useRouter()
  const [limit, setLimit] = useState(50)
  const refresh = useCallback(() => {
    void run(async current => {
      const value = await fetchMessageReaders(session!, config.chat, id, messageID, seq)
      if (!current())
        return
      syncMessageReaders(id, messageID, value.readCount, value.unreadCount)
      setResult(value)
      if (groupID) {
        setRoles([])
        const people: Person[] = []
        let offset = 0
        while (current()) {
          const page = await directory.members(groupID, offset)
          people.push(...page)
          if (page.length < 30)
            break
          offset += page.length
        }
        if (current() && people)
          setRoles(people)
      }
    })
  }, [config.chat, id, messageID, run, seq, session, groupID])
  useEffect(() => {
    refresh()
  }, [refresh])
  const members = result?.members.filter(member => member.read === read) || []
  return (
    <ProductPage
      title='消息已读情况'
      white
      busy={busy}
      error={error}
      backHref='/chats'
      right={<HeaderAction title='刷新' disabled={busy} onPress={refresh} />}
      headerContent={
        result && (
          <ProductSegment
            options={[
              { value: 'read', label: `已读 ${result.readCount}` },
              { value: 'unread', label: `未读 ${result.unreadCount}` },
            ]}
            value={read ? 'read' : 'unread'}
            onChange={value => {
              setRead(value === 'read')
              setLimit(50)
            }}
          />
        )
      }
    >
      {result && (
        <>
          {!members.length && <ProductEmpty title={read ? '还没有成员读过' : '所有成员都已读'} />}
          {members.slice(0, limit).map((member, index) => (
            <ProductListRow
              small
              last={index === Math.min(limit, members.length) - 1}
              key={member.userID}
              title={member.nickname || member.userID}
              subtitle={
                roles.find(person => person.userID === member.userID)?.roleLevel === 100
                  ? '群主'
                  : roles.find(person => person.userID === member.userID)?.roleLevel === 60
                    ? '管理员'
                    : roles.some(person => person.userID === member.userID)
                      ? '成员'
                      : undefined
              }
              leading={
                <ProductAvatar
                  id={member.userID}
                  title={member.nickname || member.userID}
                  uri={member.faceURL}
                  size={44}
                />
              }
              onPress={() => router.push(`/chats/people/${encodeURIComponent(member.userID)}`)}
            />
          ))}
          {members.length > limit && (
            <HeaderAction title='加载更多成员' onPress={() => setLimit(value => value + 50)} />
          )}
          {!!result.excludedJoinedLater && (
            <ProductHint>已排除发送后加入的 {result.excludedJoinedLater} 名成员</ProductHint>
          )}
        </>
      )}
    </ProductPage>
  )
}
