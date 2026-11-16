import React, { useCallback, useEffect, useState } from 'react'
import { Href, useLocalSearchParams, useRouter } from 'expo-router'
import { profile } from '../application/profile'
import { chooseAvatar } from '../application/profile-avatar'
import { useOpenIM } from '../application/store'
import LoginScreen from '../auth/LoginScreen'
import type { Person } from '../domain/directory'
import type { SelfProfile } from '../domain/profile'
import { Action, Confirm, Field, Label, Page, PersonRow } from '../shared/shared'
import { useTask } from '../shared/useTask'
import PasswordForm from './PasswordForm'

export default function SettingsScreen () {
  const { session } = useOpenIM()
  return session ? <Settings key={`${session.userID}:${session.imToken}`} /> : <LoginScreen />
}
function Settings () {
  const router = useRouter()
  const { section } = useLocalSearchParams<{ section?: string }>()
  const show = (name: string) => !section || section === name
  const titles: Record<string, string> = { profile: '个人资料', privacy: '隐私与黑名单', notifications: '消息通知', security: '账户安全' }
  const task = useTask()
  const { run } = task
  const [self, setSelf] = useState<SelfProfile>()
  const [nickname, setNickname] = useState('')
  const [faceURL, setFaceURL] = useState('')
  const [blocked, setBlocked] = useState<Person[]>([])
  const [remove, setRemove] = useState<Person>()
  const [notice, setNotice] = useState('')
  const refresh = useCallback(() => run(async current => {
    const [user, list] = await Promise.all([profile.self(), profile.blacklist()])
    if (current()) {
      setSelf(user)
      setNickname(user.nickname || '')
      setFaceURL(user.faceURL || '')
      setBlocked(list)
    }
  }), [run])
  useEffect(() => {
    void refresh() 
  }, [refresh])
  return <Page title={titles[section || ''] || '我的资料与设置'} {...task}>
    <Action title='刷新' disabled={task.busy} onPress={() => {
      void refresh() 
    }}
    />
    {show('profile') && <>
      {self && <PersonRow person={self} />}
      <Field placeholder='昵称' value={nickname} onChangeText={setNickname} />
      <Field placeholder='头像图片地址（http / https）' value={faceURL} onChangeText={setFaceURL} />
      <Action title='选择图片并更新头像' disabled={task.busy || !self} onPress={() => {
        void run(async current => {
          const url = await chooseAvatar(current)
          if (!url || !current() || !self)
            return
          await profile.updateSelf(self.nickname || self.userID, url)
          if (current()) {
            setFaceURL(url)
            setSelf(user => user && ({ ...user, faceURL: url }))
            setNotice('头像已上传并保存')
          }
        })
      }}
      />
      <Action title='保存我的资料' disabled={task.busy || !self || !nickname.trim()} onPress={() => {
        void run(async current => {
          await profile.updateSelf(nickname, faceURL)
          if (current()) {
            setSelf(user => user && ({ ...user, nickname: nickname.trim(), faceURL: faceURL.trim() }))
            setNotice('资料已保存')
          }
        })
      }}
      />
    </>}
    {!!notice && <Label>{notice}</Label>}
    {show('privacy') && <>
      <Label>黑名单 · {blocked.length}</Label>
      {!blocked.length && !task.busy && <Label>暂无黑名单用户</Label>}
      {blocked.map(person => <PersonRow key={person.userID} person={person}>
        <Action title='查看资料' onPress={() => router.push(`/chats/people/${encodeURIComponent(person.userID)}` as Href)} />
        <Action title='移出黑名单' disabled={task.busy} onPress={() => setRemove(person)} />
      </PersonRow>)}
      {remove && <Confirm error={task.error} message={`将 ${remove.nickname || remove.userID} 移出黑名单？`} busy={task.busy} onCancel={() => setRemove(undefined)} onConfirm={() => {
        void run(async current => {
          await profile.block(remove.userID, false)
          if (current()) {
            setBlocked(items => items.filter(person => person.userID !== remove.userID))
            setRemove(undefined)
          }
        })
      }}
      />}
    </>}
    {show('notifications') && <>
      <Label>全局消息通知</Label>
      <Label>{self?.globalRecvMsgOpt === 2 ? '已开启全局免打扰' : self?.globalRecvMsgOpt === 1 ? '当前为不接收消息' : '正常接收消息通知'}。此开关不修改系统通知权限。</Label>
      <Action title={self?.globalRecvMsgOpt === 2 ? '关闭全局免打扰' : '开启全局免打扰'} disabled={task.busy || !self} onPress={() => {
        void run(async current => {
          const muted = self?.globalRecvMsgOpt !== 2
          await profile.muteNotifications(muted)
          if (current()) {
            setSelf(user => user && ({ ...user, globalRecvMsgOpt: muted ? 2 : 0 }))
            setNotice('消息通知设置已保存')
          }
        })
      }}
      />
    </>}
    {show('security') && <PasswordForm />}
  </Page>
}
