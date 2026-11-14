import React, { useEffect, useState } from 'react'
import { useLocalSearchParams, useRouter, type Href } from 'expo-router'
import { useOpenIM } from '../application/store'
import { platformID } from '../config'
import { useTask } from '../shared/useTask'
import { createAccountService, type AccountMode } from './account-api'
import { AdvancedSettings, AuthButton, AuthField, AuthLink, AuthNotice, AuthPage } from './AuthForm'

const emailEnabled = process.env.EXPO_PUBLIC_OPENIM_EMAIL_VERIFICATION_ENABLED === 'true'
export default function AccountScreen ({ mode: requestedMode }: { mode?: AccountMode }) {
  const params = useLocalSearchParams<{ mode?: string, chat?: string, api?: string, ws?: string, email?: string }>()
  const router = useRouter()
  const mode = requestedMode || (params.mode === 'reset' ? 'reset' : 'register')
  const registering = mode === 'register'
  const { config } = useOpenIM()
  const task = useTask()
  const [baseURL, setBaseURL] = useState(params.chat || config.chat)
  const [email, setEmail] = useState(params.email || '')
  const [nickname, setNickname] = useState('')
  const [invitationCode, setInvitationCode] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  const [notice, setNotice] = useState('')
  const [done, setDone] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  useEffect(() => {
    if (!cooldown)
      return
    const timer = setTimeout(() => setCooldown(value => Math.max(0, value - 1)), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  const service = createAccountService(baseURL.trim(), platformID, emailEnabled)
  const backToLogin = () => router.replace({ pathname: '/auth/login', params: { email: email.trim(), chat: baseURL, api: params.api || config.api, ws: params.ws || config.ws } } as Href)
  const submit = () => {
    void task.run(async current => {
      await service.submit({ mode, email: email.trim(), code, password, nickname, invitationCode })
      if (current()) {
        setPassword('')
        setRepeat('')
        setCode('')
        setDone(true)
      }
    })
  }
  return <AuthPage title={done ? (registering ? '注册成功' : '密码已重置') : (registering ? '创建账户' : '找回密码')} subtitle={done ? '一切就绪，使用邮箱和密码登录，开始聊天吧。' : (registering ? '填写账户信息，开启你的第一段对话。' : '通过邮箱验证码，为你的账户设置新密码。')}>
    {done ? <AuthButton title='返回登录' onPress={backToLogin} /> : <>
      {!emailEnabled && <AuthNotice>邮箱验证服务尚未开通，注册和找回密码暂不可用，请联系管理员。</AuthNotice>}
      <AuthField label='邮箱' placeholder='请输入注册邮箱' keyboardType='email-address' autoComplete='email' value={email} onChangeText={setEmail} editable={!task.busy} />
      {!!email && !validEmail && <AuthNotice error>请填写有效的邮箱地址</AuthNotice>}
      {registering && <>
        <AuthField label='昵称' placeholder='朋友们如何称呼你' value={nickname} onChangeText={setNickname} editable={!task.busy} />
        <AuthField label='邀请码（选填）' placeholder='服务要求时填写' value={invitationCode} onChangeText={setInvitationCode} editable={!task.busy} />
      </>}
      <AuthButton title={cooldown ? `${cooldown} 秒后重新发送` : '发送邮箱验证码'} secondary disabled={task.busy || !emailEnabled || !validEmail || cooldown > 0} onPress={() => {
        void task.run(async current => {
          await service.sendCode(email.trim(), mode, invitationCode.trim())
          if (current()) {
            setNotice('验证码已发送，请检查邮箱及垃圾邮件文件夹。')
            setCooldown(60)
          }
        })
      }}
      />
      {!!notice && <AuthNotice>{notice}</AuthNotice>}
      <AuthField label='邮箱验证码' placeholder='请输入收到的验证码' autoComplete='one-time-code' value={code} onChangeText={setCode} editable={!task.busy} />
      <AuthField label={registering ? '密码' : '新密码'} placeholder='请输入密码' password autoComplete='new-password' value={password} onChangeText={setPassword} editable={!task.busy} />
      <AuthField label='确认密码' placeholder='再次输入密码' password autoComplete='new-password' value={repeat} onChangeText={setRepeat} editable={!task.busy} />
      {!!repeat && password !== repeat && <AuthNotice error>两次输入的密码不一致</AuthNotice>}
      {!!task.error && <AuthNotice error>{task.error}</AuthNotice>}
      <AuthButton title={task.busy ? '正在处理…' : registering ? '创建账户' : '重置密码'} busy={task.busy} disabled={!emailEnabled || !validEmail || (registering && !nickname.trim()) || !code.trim() || !password || password !== repeat} onPress={submit} />
      <AuthLink title='返回登录' disabled={task.busy} onPress={backToLogin} />
      <AdvancedSettings><AuthField label='账户服务地址' keyboardType='url' value={baseURL} onChangeText={setBaseURL} editable={!task.busy} /></AdvancedSettings>
    </>}
  </AuthPage>
}
