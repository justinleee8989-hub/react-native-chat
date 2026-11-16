import React, { useCallback, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { ChatListAvatar } from '@kesha-antonov/react-native-chat'
import { Href, useFocusEffect, useRouter } from 'expo-router'
import { useChatListColors } from '@/components/chat-list/theme'
import { profile } from '../application/profile'
import { logout, useOpenIM } from '../application/store'
import type { SelfProfile } from '../domain/profile'
import { Action, Confirm, Page } from '../shared/shared'
import { useTask } from '../shared/useTask'

const links = [
  { title: '个人资料', subtitle: '头像与昵称', icon: 'account-outline', href: '/chats/settings?section=profile' },
  { title: '消息通知', subtitle: '全局免打扰设置', icon: 'bell-outline', href: '/chats/settings?section=notifications' },
  { title: '隐私与黑名单', subtitle: '管理已屏蔽的用户', icon: 'shield-account-outline', href: '/chats/settings?section=privacy' },
  { title: '账户安全', subtitle: '修改登录密码', icon: 'lock-outline', href: '/chats/settings?section=security' },
  { title: '通话记录', subtitle: '查看语音与视频通话', icon: 'phone-outline', href: '/chats/call-history' },
  { title: '归档会话', subtitle: '查看已归档的消息', icon: 'archive-outline', href: '/chats/archived' },
] as const

export default function MyScreen () {
  const { session } = useOpenIM()
  return session ? <MyAccount key={`${session.userID}:${session.imToken}`} userID={session.userID} /> : null
}
function MyAccount ({ userID }: { userID: string }) {
  const colors = useChatListColors()
  const router = useRouter()
  const { status, busy } = useOpenIM()
  const task = useTask()
  const { run } = task
  const [self, setSelf] = useState<SelfProfile>()
  const [confirmLogout, setConfirmLogout] = useState(false)
  useFocusEffect(useCallback(() => {
    void run(async current => {
      const result = await profile.self()
      if (current())
        setSelf(result)
    })
  }, [run]))
  return <Page title='我的' root {...task}>
    <Pressable accessibilityRole='button' accessibilityLabel='编辑个人资料' onPress={() => router.push('/chats/settings?section=profile' as Href)} style={[styles.profile, { backgroundColor: colors.pressed }]}>
      <ChatListAvatar id={userID} title={self?.nickname || userID} uri={self?.faceURL} size={68} />
      <View style={styles.identity}>
        <Text style={[styles.name, { color: colors.name }]}>{self?.nickname || userID}</Text>
        <Text selectable style={{ color: colors.message }}>ID：{userID}</Text>
        <Text style={{ color: colors.message }}>{status}</Text>
      </View>
      <MaterialCommunityIcons name='chevron-right' size={24} color={colors.message} />
    </Pressable>
    <View style={[styles.menu, { borderColor: colors.divider }]}>
      {links.map(link => <Pressable key={link.href} accessibilityRole='button' onPress={() => router.push(link.href as Href)} style={[styles.item, { borderColor: colors.divider }]}>
        <MaterialCommunityIcons name={link.icon} size={24} color={colors.badge} />
        <View style={styles.identity}>
          <Text style={{ color: colors.name, fontSize: 16, fontWeight: '600' }}>{link.title}</Text>
          <Text style={{ color: colors.message, fontSize: 13 }}>{link.subtitle}</Text>
        </View>
        <MaterialCommunityIcons name='chevron-right' size={22} color={colors.message} />
      </Pressable>)}
    </View>
    <Action title='退出登录' danger disabled={busy} onPress={() => setConfirmLogout(true)} />
    {confirmLogout && <Confirm message='确认退出当前账户？你可以随时重新登录。' busy={busy} onCancel={() => setConfirmLogout(false)} onConfirm={() => {
      void logout().then(() => router.replace('/auth/login' as Href))
    }}
    />}

  </Page>
}
const styles = StyleSheet.create({
  profile: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 20, borderRadius: 16 },
  identity: { flex: 1, gap: 6 },
  name: { fontSize: 22, fontWeight: '700' },
  menu: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, overflow: 'hidden' },
  item: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 18, borderBottomWidth: StyleSheet.hairlineWidth },
})
