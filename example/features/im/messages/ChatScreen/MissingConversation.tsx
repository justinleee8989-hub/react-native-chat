import React from 'react'
import { Button, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { styles } from './styles'

/** The chat is not in the conversation list (yet): a way back instead of an empty page. */
export function MissingConversation () {
  const router = useRouter()
  return (
    <View style={styles.container}>
      <Button
        title='返回会话列表'
        onPress={() => {
          if (router.canGoBack())
            router.back()
          else
            router.replace('/(tabs)/chats')
        }}
      />
      <Text>正在同步会话；若刷新后仍不存在，请返回列表重新打开。</Text>
    </View>
  )
}
