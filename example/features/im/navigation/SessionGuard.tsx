import React, { useEffect, useState } from 'react'
import { Href, useRootNavigationState, useRouter, useSegments } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { useOpenIM } from '../application/store'
import { sessionKey, useStartupReadiness } from './StartupReadiness'
import { StartupScreen } from './StartupScreen'

/** Keep the root navigator mounted while saved credentials are restored. */
export default function SessionGuard () {
  const { initialized, session, busy } = useOpenIM()
  const segments = useSegments()
  const router = useRouter()
  const navigation = useRootNavigationState()
  const auth = segments[0] === 'auth'
  const development = segments[0] === 'chat' || segments[0] === 'explore'
  useEffect(() => {
    if (!navigation?.key || !initialized || (!session && busy) || development)
      return
    if (!session && !auth)
      router.replace('/auth/login' as Href)
    else if (session && auth)
      router.replace('/(tabs)/chats')
  }, [auth, busy, development, initialized, navigation?.key, router, session])
  const { readyKey, markReady } = useStartupReadiness()
  const account = sessionKey(session)
  const home = segments[0] === '(tabs)' && (!segments[1] || segments[1] === 'chats')
  const routeReady = development || (initialized && (auth ? !session : !!session))
  const homePending = !!session && home && readyKey !== account
  const [presented, setPresented] = useState('')
  const [slow, setSlow] = useState(false)
  useEffect(() => {
    if (!homePending)
      return
    const timer = setTimeout(() => setSlow(true), 15000)
    return () => {
      clearTimeout(timer)
      setSlow(false)
    }
  }, [homePending, session])
  useEffect(() => {
    if (!routeReady || homePending || !session)
      return
    // Content-size/empty-state layout has committed. Keep the product cover through
    // the next paint rather than exposing the FlatList's initial mount.
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => setPresented(account))
    })
    return () => cancelAnimationFrame(frame)
  }, [account, homePending, routeReady, session])
  const ready = routeReady && (!session || !home || presented === account)
  useEffect(() => {
    if (!ready)
      return
    // A fast restore can skip the RN startup view entirely. Let the resolved route
    // commit its first frame before removing the native surface above it.
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => SplashScreen.hide())
    })
    return () => cancelAnimationFrame(frame)
  }, [ready])
  if (ready)
    return null
  return <StartupScreen onContinue={slow && session && routeReady ? () => markReady(session) : undefined} />
}
