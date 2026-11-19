import React, { useEffect, useRef, useState } from 'react'
import type { TextInput } from 'react-native'
import { useLocalSearchParams, useNavigation, useRouter, type Href } from 'expo-router'
import { login, useOpenIM } from '../application/store'
import { useT } from '../i18n'
import { type NavigationWithTransitions, onOpeningTransition } from '../navigation/opening-transition'
import { errorMessage } from '../shared/error-message'
import {
  AuthButton,
  AuthField,
  AuthLink,
  AuthNotice,
  AuthPage,
  AuthPrompt,
} from './AuthForm'

export default function LoginScreen () {
  const tr = useT()
  const router = useRouter()
  const params = useLocalSearchParams<{ email?: string }>()
  const state = useOpenIM()
  // The account last signed in here, unless the page was opened with one (from 注册 or 忘记密码):
  // a sign-out for an expired login then only asks for the password.
  const last = params.email ? undefined : state.lastAccount
  const [account, setAccount] = useState(params.email || last?.account || '')
  const [password, setPassword] = useState('')
  // The last account is read from storage alongside startup and can arrive after this page mounts;
  // it fills the form then, unless the user has started typing.
  const touched = useRef(!!(params.email || last))
  const lastAccount = state.lastAccount
  useEffect(() => {
    if (touched.current || params.email || !lastAccount)
      return
    touched.current = true
    setAccount(lastAccount.account)
  }, [lastAccount, params.email])
  // A refused sign-in edges both fields in red, and the sprite slumps, until the user types again.
  const [refused, setRefused] = useState(false)
  const failed = refused && !!state.error && !state.busy
  // Typing again also puts away the refusal's notice. A notice the page opened with (why the user
  // was signed out) stays: it was never a refusal. The next refusal is a new error, and shows.
  const [dismissed, setDismissed] = useState<unknown>()
  const notice = state.error && state.error !== dismissed ? state.error : undefined
  const edit = () => {
    if (refused)
      setDismissed(state.error)
    setRefused(false)
  }
  const type = (value: string) => {
    touched.current = true
    edit()
    setAccount(value)
  }
  const typePassword = (value: string) => {
    edit()
    setPassword(value)
  }
  // What the sprite in the brand mark acts out: the field in use, and the password while it is shown
  // (on the web, pressing 显示 takes the focus off the field).
  const [focused, setFocused] = useState<'email' | 'password'>()
  const [shown, setShown] = useState(false)
  const mood = state.busy
    ? 'busy'
    : failed
      ? 'error'
      : focused === 'email'
        ? 'email'
        : shown && !!password
          ? 'peek'
          : focused === 'password'
            ? 'password'
            : 'idle'
  const blur = () => setFocused(undefined)
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
    router.push({ pathname: `/auth/${mode}`, params: { email: account.trim() } } as Href)
  const submit = () => {
    if (!account.trim() || !password || state.busy)
      return
    setRefused(true)
    void login(account.trim(), password)
  }
  return (
    <AuthPage
      title={tr('auth.welcomeBack')}
      subtitle={tr('auth.loginSubtitle')}
      mood={mood}
      typed={account.length}
      end={(
        <AuthPrompt text={tr('auth.noAccount')}>
          <AuthLink title={tr('auth.register')} disabled={state.busy} onPress={() => navigate('register')} />
        </AuthPrompt>
      )}
    >
      <AuthField
        label={tr('auth.emailAccount')}
        showLabel
        placeholder={tr('auth.emailPlaceholder')}
        keyboardType='email-address'
        autoComplete='email'
        value={account}
        onChangeText={type}
        onFocus={() => setFocused('email')}
        onBlur={blur}
        invalid={failed}
        editable={!state.busy}
      />
      <AuthField
        label={tr('auth.password')}
        showLabel
        placeholder={tr('auth.passwordPlaceholder')}
        password
        reveal
        onRevealChange={setShown}
        autoComplete='current-password'
        ref={passwordField}
        autoFocus={filled}
        value={password}
        onChangeText={typePassword}
        onFocus={() => setFocused('password')}
        onBlur={blur}
        invalid={failed}
        editable={!state.busy}
        returnKeyType='go'
        onSubmitEditing={submit}
      />
      <AuthLink title={tr('auth.forgotPassword')} trailing disabled={state.busy} onPress={() => navigate('reset')} />
      {!!notice && <AuthNotice error>{errorMessage(notice, tr)}</AuthNotice>}
      <AuthButton
        title={state.busy ? tr('auth.connecting') : tr('auth.signIn')}
        busy={state.busy}
        disabled={!account.trim() || !password}
        onPress={submit}
      />
    </AuthPage>
  )
}
