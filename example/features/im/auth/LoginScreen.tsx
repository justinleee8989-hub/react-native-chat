import React, { useEffect, useRef, useState } from 'react'
import type { TextInput } from 'react-native'
import { useLocalSearchParams, useNavigation, useRouter, type Href } from 'expo-router'
import { login, useOpenIM } from '../application/store'
import { type NavigationWithTransitions, onOpeningTransition } from '../navigation/opening-transition'
import {
  AdvancedSettings,
  AuthButton,
  AuthField,
  AuthLink,
  AuthLinks,
  AuthNotice,
  AuthPage,
} from './AuthForm'

export default function LoginScreen () {
  const router = useRouter()
  const params = useLocalSearchParams<{
    email?: string
    chat?: string
    api?: string
    ws?: string
  }>()
  const state = useOpenIM()
  // The account last signed in here, unless the page was opened with one (from 注册 or 忘记密码):
  // a sign-out for an expired login then only asks for the password.
  const last = params.email ? undefined : state.lastAccount
  const [account, setAccount] = useState(params.email || last?.account || '')
  const [password, setPassword] = useState('')
  const [config, setConfig] = useState({
    chat: params.chat || last?.config.chat || state.config.chat,
    api: params.api || last?.config.api || state.config.api,
    ws: params.ws || last?.config.ws || state.config.ws,
  })
  // The last account is read from storage alongside startup and can arrive after this page mounts;
  // it fills the form then, unless the user has started typing.
  const touched = useRef(!!(params.email || last))
  const lastAccount = state.lastAccount
  useEffect(() => {
    if (touched.current || params.email || !lastAccount)
      return
    touched.current = true
    setAccount(lastAccount.account)
    setConfig(lastAccount.config)
  }, [lastAccount, params.email])
  const type = (value: string) => {
    touched.current = true
    setAccount(value)
  }
  // Opened at start-up, `autoFocus` brings up the keyboard. After a sign-out the page arrives with
  // a stack transition, and Android gives a field focused during it the cursor but no keyboard;
  // focusing again when the opening transition ends shows it. Its closing transition (signed in)
  // is ignored, or the keyboard would come up over the home page.
  const passwordField = useRef<React.ComponentRef<typeof TextInput>>(null)
  const filled = !!account
  const navigation = useNavigation() as unknown as NavigationWithTransitions
  useEffect(() => {
    if (!filled)
      return
    return onOpeningTransition(navigation, 'transitionEnd', () => passwordField.current?.focus())
  }, [filled, navigation])
  const navigate = (mode: 'register' | 'reset') =>
    router.push({ pathname: `/auth/${mode}`, params: { ...config, email: account.trim() } } as Href)
  const submit = () => {
    if (account.trim() && password && !state.busy)
      void login(account.trim(), password, config)
  }
  return (
    <AuthPage title='欢迎回来' subtitle='登录你的账户，继续与朋友保持联系。'>
      <AuthField
        label='邮箱账号'
        placeholder='邮箱账号'
        keyboardType='email-address'
        autoComplete='email'
        value={account}
        onChangeText={type}
        editable={!state.busy}
      />
      <AuthField
        label='密码'
        placeholder='密码'
        password
        reveal
        autoComplete='current-password'
        ref={passwordField}
        autoFocus={filled}
        value={password}
        onChangeText={setPassword}
        editable={!state.busy}
        returnKeyType='go'
        onSubmitEditing={submit}
      />
      {!!state.error && <AuthNotice error>{state.error}</AuthNotice>}
      <AuthButton
        title={state.busy ? '正在连接…' : '登录'}
        busy={state.busy}
        disabled={!account.trim() || !password}
        onPress={submit}
      />
      <AuthLinks>
        <AuthLink title='忘记密码？' disabled={state.busy} onPress={() => navigate('reset')} />
        <AuthLink title='注册新账户' disabled={state.busy} onPress={() => navigate('register')} />
      </AuthLinks>
      <AdvancedSettings>
        {(['chat', 'api', 'ws'] as const).map(field => (
          <AuthField
            compact
            key={field}
            placeholder={{ chat: '账户服务地址', api: '消息服务地址', ws: '实时连接地址' }[field]}
            label={{ chat: '账户服务地址', api: '消息服务地址', ws: '实时连接地址' }[field]}
            keyboardType='url'
            value={config[field]}
            editable={!state.busy}
            onChangeText={value => setConfig(current => ({ ...current, [field]: value }))}
          />
        ))}
      </AdvancedSettings>
    </AuthPage>
  )
}
