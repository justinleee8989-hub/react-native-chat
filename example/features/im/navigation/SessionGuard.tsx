import { useEffect } from 'react'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import { Href, useRootNavigationState, useRouter, useSegments } from 'expo-router'
import { useChatListColors } from '@/components/chat-list/theme'
import { useOpenIM } from '../application/store'

/** Keep the root navigator mounted while saved credentials are restored. */
export default function SessionGuard () {
  const { initialized, session, busy } = useOpenIM()
  const segments = useSegments()
  const router = useRouter()
  const navigation = useRootNavigationState()
  const colors = useChatListColors()
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
  if (development || (initialized && (auth ? !session : !!session)))
    return null
  return <View style={[StyleSheet.absoluteFill, styles.loading, { backgroundColor: colors.background }]} accessibilityViewIsModal>
    <ActivityIndicator color={colors.badge} />
    <Text style={{ color: colors.message }}>正在恢复登录…</Text>
  </View>
}
const styles = StyleSheet.create({ loading: { alignItems: 'center', justifyContent: 'center', gap: 16 } })
