import React, { useEffect, useState } from 'react'
import { useLocalSearchParams, useRouter, type Href } from 'expo-router'
import { login, useOpenIM } from '../application/store'
import { defaultConfig, platformID } from '../config'
import type { MessageKey } from '../i18n'
import { useT } from '../i18n'
import { errorMessage } from '../shared/error-message'
import { showProductToast } from '../shared/ProductToast'
import { useTask } from '../shared/useTask'
import { createAccountService, type AccountMode } from './account-api'
import { AuthButton, AuthField, AuthLink, AuthNotice, AuthPage } from './AuthForm'

const emailEnabled = process.env.EXPO_PUBLIC_OPENIM_EMAIL_VERIFICATION_ENABLED === 'true'
export default function AccountScreen ({ mode: requestedMode }: { mode?: AccountMode }) {
  const tr = useT()
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
  const [notice, setNotice] = useState<MessageKey>()
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
        showProductToast(tr('auth.passwordResetDone'))
        backToLogin()
      }
    })
  }
  return (
    <AuthPage
      brand={false}
      onBack={backToLogin}
      title={registering ? tr('auth.createAccount') : tr('auth.resetTitle')}
      subtitle={registering ? tr('auth.registerSubtitle') : tr('auth.resetSubtitle')}
    >
      <>
        {!emailEnabled && (
          <AuthNotice>{tr('auth.emailDisabled')}</AuthNotice>
        )}
        <AuthField
          label={tr('auth.email')}
          placeholder={registering ? tr('auth.email') : tr('auth.registeredEmail')}
          keyboardType='email-address'
          autoComplete='email'
          value={email}
          onChangeText={setEmail}
          editable={!task.busy && !loginBusy && !created}
        />
        {!!email && !validEmail && <AuthNotice error>{tr('auth.invalidEmail')}</AuthNotice>}
        {registering && (
          <>
            <AuthField
              label={tr('auth.nickname')}
              placeholder={tr('auth.nicknamePlaceholder')}
              value={nickname}
              onChangeText={setNickname}
              editable={!task.busy && !loginBusy && !created}
            />
          </>
        )}
        {!!notice && <AuthNotice>{tr(notice)}</AuthNotice>}
        <AuthField
          label={tr('auth.emailCode')}
          placeholder={tr('auth.emailCode')}
          autoComplete='one-time-code'
          value={code}
          onChangeText={setCode}
          editable={!task.busy && !loginBusy && !created}
          trailing={
            <AuthLink
              accessibilityLabel={cooldown ? tr('auth.resendIn', { seconds: cooldown }) : tr('auth.sendEmailCode')}
              title={cooldown ? tr('auth.resendIn', { seconds: cooldown }) : tr('auth.sendCode')}
              disabled={
                created || loginBusy || task.busy || !emailEnabled || !validEmail || cooldown > 0
              }
              onPress={() => {
                void task.run(async current => {
                  await service.sendCode(email.trim(), mode, invitationCode.trim())
                  if (current()) {
                    setNotice('auth.codeSent')
                    setCooldown(60)
                  }
                })
              }}
            />
          }
        />
        <AuthField
          label={registering ? tr('auth.password') : tr('auth.newPassword')}
          placeholder={registering ? tr('auth.passwordHint') : tr('auth.newPasswordHint')}
          password
          autoComplete='new-password'
          value={password}
          onChangeText={setPassword}
          editable={!task.busy && !loginBusy && !created}
        />
        <AuthField
          label={tr('auth.confirmPassword')}
          placeholder={registering ? tr('auth.confirmPassword') : tr('auth.confirmNewPassword')}
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
            label={tr('auth.invitationCode')}
            placeholder={tr('auth.invitationCode')}
            value={invitationCode}
            onChangeText={setInvitationCode}
            editable={!task.busy && !loginBusy && !created}
          />
        )}
        {!!repeat && password !== repeat && <AuthNotice error>{tr('auth.passwordMismatch')}</AuthNotice>}
        {!!(task.error || (created && loginError)) && (
          <AuthNotice error>{task.error || errorMessage(loginError, tr)}</AuthNotice>
        )}
        {created && !session && <AuthNotice>{tr('auth.createdRetryLogin')}</AuthNotice>}
        <AuthButton
          title={
            task.busy || loginBusy
              ? tr('auth.working')
              : created
                ? tr('auth.retryLogin')
                : registering
                  ? tr('auth.createAccount')
                  : tr('auth.resetPassword')
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
          title={registering ? tr('auth.haveAccount') : tr('auth.backToLogin')}
          disabled={task.busy || loginBusy}
          onPress={backToLogin}
        />
      </>
    </AuthPage>
  )
}
