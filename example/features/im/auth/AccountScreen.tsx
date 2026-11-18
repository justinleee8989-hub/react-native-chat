import React, { useEffect, useState } from 'react'
import { useLocalSearchParams, useRouter, type Href } from 'expo-router'
import { login, useOpenIM } from '../application/store'
import { defaultConfig, platformID } from '../config'
import { showProductToast } from '../shared/ProductToast'
import { useTask } from '../shared/useTask'
import { createAccountService, type AccountMode } from './account-api'
import { AuthButton, AuthField, AuthLink, AuthNotice, AuthPage } from './AuthForm'

const emailEnabled = process.env.EXPO_PUBLIC_OPENIM_EMAIL_VERIFICATION_ENABLED === 'true'
export default function AccountScreen ({ mode: requestedMode }: { mode?: AccountMode }) {
  const params = useLocalSearchParams<{ mode?: string, email?: string }>()
  const router = useRouter()
  const mode = requestedMode || (params.mode === 'reset' ? 'reset' : 'register')
  const registering = mode === 'register'
  const { session, error: loginError, busy: loginBusy } = useOpenIM()
  const task = useTask()
  const [email, setEmail] = useState(params.email || '')
  const [nickname, setNickname] = useState('')
  const [invitationCode, setInvitationCode] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  const [notice, setNotice] = useState('')
  const [created, setCreated] = useState(false)
  useEffect(() => {
    if (session)
      router.replace('/(tabs)/chats')
  }, [session, router])
  const [cooldown, setCooldown] = useState(0)
  useEffect(() => {
    if (!cooldown)
      return
    const timer = setTimeout(() => setCooldown(value => Math.max(0, value - 1)), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  // The servers the app was built for: there is no choosing one on the login pages.
  const service = createAccountService(defaultConfig.chat, platformID, emailEnabled)
  const backToLogin = () =>
    router.replace({
      pathname: '/auth/login',
      params: { email: email.trim() },
    } as Href)
  const submit = () => {
    if (
      task.busy ||
      loginBusy ||
      !emailEnabled ||
      !validEmail ||
      (registering && !nickname.trim()) ||
      !code.trim() ||
      password.length < 6 ||
      password !== repeat
    )
      return
    void task.run(async current => {
      if (!created) {
        await service.submit({
          mode,
          email: email.trim(),
          code,
          password,
          nickname,
          invitationCode,
        })
        if (!current())
          return
        if (registering)
          setCreated(true)
      }
      if (registering) {
        await login(email.trim(), password)
      } else if (current()) {
        setPassword('')
        setRepeat('')
        setCode('')
        showProductToast('密码已重置，请使用新密码登录')
        backToLogin()
      }
    })
  }
  return (
    <AuthPage
      brand={false}
      onBack={backToLogin}
      title={registering ? '创建账户' : '找回密码'}
      subtitle={registering ? '用邮箱注册，几步就能开始聊天。' : '通过邮箱验证码重置登录密码。'}
    >
      <>
        {!emailEnabled && (
          <AuthNotice>邮箱验证服务尚未开通，注册和找回密码暂不可用，请联系管理员。</AuthNotice>
        )}
        <AuthField
          label='邮箱'
          placeholder={registering ? '邮箱' : '注册邮箱'}
          keyboardType='email-address'
          autoComplete='email'
          value={email}
          onChangeText={setEmail}
          editable={!task.busy && !loginBusy && !created}
        />
        {!!email && !validEmail && <AuthNotice error>请填写有效的邮箱地址</AuthNotice>}
        {registering && (
          <>
            <AuthField
              label='昵称'
              placeholder='昵称：朋友们如何称呼你'
              value={nickname}
              onChangeText={setNickname}
              editable={!task.busy && !loginBusy && !created}
            />
          </>
        )}
        {!!notice && <AuthNotice>{notice}</AuthNotice>}
        <AuthField
          label='邮箱验证码'
          placeholder='邮箱验证码'
          autoComplete='one-time-code'
          value={code}
          onChangeText={setCode}
          editable={!task.busy && !loginBusy && !created}
          trailing={
            <AuthLink
              accessibilityLabel={cooldown ? `${cooldown} 秒后重新发送` : '发送邮箱验证码'}
              title={cooldown ? `${cooldown} 秒后重新发送` : '发送验证码'}
              disabled={
                created || loginBusy || task.busy || !emailEnabled || !validEmail || cooldown > 0
              }
              onPress={() => {
                void task.run(async current => {
                  await service.sendCode(email.trim(), mode, invitationCode.trim())
                  if (current()) {
                    setNotice('验证码已发送，请检查邮箱及垃圾邮件文件夹。')
                    setCooldown(60)
                  }
                })
              }}
            />
          }
        />
        <AuthField
          label={registering ? '密码' : '新密码'}
          placeholder={registering ? '密码（至少 6 位）' : '新密码（至少 6 位）'}
          password
          autoComplete='new-password'
          value={password}
          onChangeText={setPassword}
          editable={!task.busy && !loginBusy && !created}
        />
        <AuthField
          label='确认密码'
          placeholder={registering ? '确认密码' : '确认新密码'}
          returnKeyType={registering ? 'next' : 'go'}
          onSubmitEditing={registering ? undefined : submit}
          password
          autoComplete='new-password'
          value={repeat}
          onChangeText={setRepeat}
          editable={!task.busy && !loginBusy && !created}
        />
        {registering && (
          <AuthField
            returnKeyType='go'
            onSubmitEditing={submit}
            label='邀请码（选填）'
            placeholder='邀请码（选填）'
            value={invitationCode}
            onChangeText={setInvitationCode}
            editable={!task.busy && !loginBusy && !created}
          />
        )}
        {!!repeat && password !== repeat && <AuthNotice error>两次输入的密码不一致</AuthNotice>}
        {!!(task.error || (created ? loginError : '')) && (
          <AuthNotice error>{task.error || (created ? loginError : '')}</AuthNotice>
        )}
        {created && !session && <AuthNotice>账户已创建，请重试登录。</AuthNotice>}
        <AuthButton
          title={
            task.busy || loginBusy
              ? '正在处理…'
              : created
                ? '重试登录'
                : registering
                  ? '创建账户'
                  : '重置密码'
          }
          busy={task.busy || loginBusy}
          disabled={
            !emailEnabled ||
            !validEmail ||
            (registering && !nickname.trim()) ||
            !code.trim() ||
            password.length < 6 ||
            password !== repeat
          }
          onPress={submit}
        />
        <AuthLink
          title={registering ? '已有账户？返回登录' : '返回登录'}
          disabled={task.busy || loginBusy}
          onPress={backToLogin}
        />
      </>
    </AuthPage>
  )
}
