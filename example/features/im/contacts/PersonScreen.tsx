import React, { useCallback, useEffect, useState } from 'react'
import { Href, useLocalSearchParams, useRouter } from 'expo-router'
import { profile } from '../application/profile'
import { openConversation, useOpenIM } from '../application/store'
import LoginScreen from '../auth/LoginScreen'
import type { Person } from '../domain/directory'
import { Action, Confirm, Field, Label, Page, PersonRow } from '../shared/shared'
import { useTask } from '../shared/useTask'

export default function PersonScreen () {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { session } = useOpenIM()
  return session ? <PersonDetails key={`${session.userID}:${session.imToken}:${id}`} id={id} selfID={session.userID} /> : <LoginScreen />
}
function PersonDetails ({ id, selfID }: { id: string, selfID: string }) {
  const router = useRouter()
  const task = useTask()
  const { run } = task
  const [person, setPerson] = useState<Person>()
  const [remark, setRemark] = useState('')
  const [blocked, setBlocked] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [notice, setNotice] = useState('')
  const refresh = useCallback(() => run(async current => {
    const [user, list] = await Promise.all([profile.person(id), profile.blacklist()])
    if (current()) {
      setPerson(user)
      setRemark(user?.remark || '')
      setBlocked(list.some(item => item.userID === id))
      setLoaded(true)
    }
  }), [id, run])
  useEffect(() => {
    void refresh() 
  }, [refresh])
  return <Page title='联系人资料' {...task}>
    <Action title='刷新' disabled={task.busy} onPress={() => {
      void refresh() 
    }}
    />
    {loaded && !person && <Label>未找到该用户</Label>}
    {person && <>
      <PersonRow person={person} />
      <Label>昵称：{person.nickname || person.userID}</Label>
      <Label>昵称由对方设置；你可以修改自己的好友备注。</Label>
      {person.isFriend ? <>
        <Field placeholder='好友备注（留空清除）' value={remark} onChangeText={setRemark} />
        <Action title='保存好友备注' disabled={task.busy || id === selfID} onPress={() => {
          void run(async current => {
            await profile.remark(id, remark)
            if (current()) {
              setPerson(user => user && ({ ...user, remark: remark.trim() }))
              setNotice('好友备注已保存')
            }
          })
        }}
        />
      </> : <Label>仅好友可设置好友备注</Label>}
      <Action title='发消息' disabled={task.busy || id === selfID || blocked} onPress={() => {
        void run(async current => {
          const conversationID = await openConversation(id)
          if (current())
            router.push(`/chats/${encodeURIComponent(conversationID)}` as Href)
        })
      }}
      />
      <Label>{blocked ? '此用户已在黑名单' : '此用户不在黑名单'}</Label>
      <Action title={blocked ? '移出黑名单' : '加入黑名单'} danger={!blocked} disabled={task.busy || id === selfID} onPress={() => setConfirm(true)} />
    </>}
    {!!notice && <Label>{notice}</Label>}
    {confirm && <Confirm message={blocked ? '确认移出黑名单？' : '加入黑名单后将无法正常接收对方的消息，确认继续？'} busy={task.busy} onCancel={() => setConfirm(false)} onConfirm={() => {
      void run(async current => {
        await profile.block(id, !blocked)
        if (current()) {
          setBlocked(!blocked)
          setConfirm(false)
        }
      })
    }}
    />}
  </Page>
}
