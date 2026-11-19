import React, { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'expo-router'
import { directory } from '../application/directory'
import { syncMessageReaders, useOpenIM } from '../application/store'
import LoginScreen from '../auth/LoginScreen'
import type { Person } from '../domain/directory'
import { HeaderAction, ProductHint } from '../groups/group-ui'
import { useT } from '../i18n'
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
  const tr = useT()
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
      title={tr('readers.title')}
      white
      busy={busy}
      error={error}
      backHref='/chats'
      right={<HeaderAction title={tr('common.refresh')} disabled={busy} onPress={refresh} />}
      headerContent={
        result && (
          <ProductSegment
            options={[
              { value: 'read', label: tr('readers.readCount', { count: result.readCount }) },
              { value: 'unread', label: tr('readers.unreadCount', { count: result.unreadCount }) },
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
          {!members.length && <ProductEmpty title={read ? tr('readers.noneRead') : tr('readers.allRead')} />}
          {members.slice(0, limit).map((member, index) => (
            <ProductListRow
              small
              last={index === Math.min(limit, members.length) - 1}
              key={member.userID}
              title={member.nickname || member.userID}
              subtitle={
                roles.find(person => person.userID === member.userID)?.roleLevel === 100
                  ? tr('role.owner')
                  : roles.find(person => person.userID === member.userID)?.roleLevel === 60
                    ? tr('role.admin')
                    : roles.some(person => person.userID === member.userID)
                      ? tr('role.memberShort')
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
            <HeaderAction title={tr('readers.loadMore')} onPress={() => setLimit(value => value + 50)} />
          )}
          {!!result.excludedJoinedLater && (
            <ProductHint>{tr('readers.excluded', { count: result.excludedJoinedLater })}</ProductHint>
          )}
        </>
      )}
    </ProductPage>
  )
}
