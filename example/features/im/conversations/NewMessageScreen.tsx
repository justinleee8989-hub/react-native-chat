import React, { useState } from 'react'
import { Button, StyleSheet, Text, TextInput, View } from 'react-native'
import { Href, useRouter } from 'expo-router'
import { openConversation, reportError, useOpenIM } from '@/features/im/application/store'
import LoginScreen from '@/features/im/auth/LoginScreen'

export default function NewMessageScreen() {
  const router = useRouter()
  const state = useOpenIM()
  const [userID, setUserID] = useState('')
  const [busy, setBusy] = useState(false)
  const start = async () => {
    setBusy(true)
    try {
      const id = await openConversation(userID)
      router.replace(`/chats/${encodeURIComponent(id)}` as Href)
    } catch (error) {
      reportError(error)
    }
    setBusy(false)
  }
  if (!state.session) 
    return <LoginScreen />
  return (
    <View style={styles.page}>
      <Button title='返回' onPress={() => router.back()} />
      <Text style={styles.title}>开始聊天</Text>
      <Text>输入已注册的 OpenIM 用户 ID</Text>
      <TextInput
        accessibilityLabel='对方用户 ID'
        placeholder='用户 ID'
        value={userID}
        onChangeText={setUserID}
        autoCapitalize='none'
        style={styles.input}
      />
      {!!state.error && (
        <Text accessibilityRole='alert' style={styles.error}>
          {state.error}
        </Text>
      )}
      <Button
        title={busy ? '正在打开…' : '打开会话'}
        disabled={busy || !userID.trim() || userID.trim() === state.session.userID}
        onPress={() => {
          void start()
        }}
      />
    </View>
  )
}
const styles = StyleSheet.create({
  page: { flex: 1, padding: 24, paddingTop: 60, gap: 16, backgroundColor: '#f4f6f8' },
  title: { fontSize: 24, fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderColor: '#bac4ce',
    borderRadius: 8,
    padding: 12,
    backgroundColor: 'white',
    color: '#17212b',
  },
  error: { color: '#b42318' },
})
