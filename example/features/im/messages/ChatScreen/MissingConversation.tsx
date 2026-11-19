import React from 'react'
import { Button, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useT } from '../../i18n'
import { styles } from './styles'

/** The chat is not in the conversation list (yet): a way back instead of an empty page. */
export function MissingConversation () {
  const tr = useT()
  const router = useRouter()
  return (
    <View style={styles.container}>
      <Button
        title={tr('chat.backToList')}
        onPress={() => {
          if (router.canGoBack())
            router.back()
          else
            router.replace('/(tabs)/chats')
        }}
      />
      <Text>{tr('chat.syncingMissing')}</Text>
    </View>
  )
}
