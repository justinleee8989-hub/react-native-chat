import React, { useState } from 'react'
import { useLocalSearchParams, useRouter, type Href } from 'expo-router'
import { login, retryRestore, useOpenIM } from '../application/store'
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
  const [account, setAccount] = useState(params.email || '')
  const [password, setPassword] = useState('')
  const [config, setConfig] = useState({
    chat: params.chat || state.config.chat,
    api: params.api || state.config.api,
    ws: params.ws || state.config.ws,
  })
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
        onChangeText={setAccount}
        editable={!state.busy}
      />
      <AuthField
        label='密码'
        placeholder='密码'
        password
        reveal
        autoComplete='current-password'
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
      {state.recoveryAvailable && (
        <AuthButton
          title='重试恢复上次登录'
          secondary
          disabled={state.busy}
          onPress={() => {
            void retryRestore()
          }}
        />
      )}
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
