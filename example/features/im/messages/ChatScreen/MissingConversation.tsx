import React from 'react'
import { Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useT } from '../../i18n'
import { ProductPressable as Pressable } from '../../ui/ProductPressable'
import { useProductTheme } from '../../ui/theme'
import { styles } from './styles'

/** The chat is not in the conversation list (yet): a way back instead of an empty page. */
export function MissingConversation () {
  const tr = useT()
  const router = useRouter()
  const t = useProductTheme()
  return (
    <View style={styles.container}>
      <Pressable
        accessibilityRole='button'
        accessibilityLabel={tr('chat.backToList')}
        onPress={() => {
          if (router.canGoBack())
            router.back()
          else
            router.replace('/(tabs)/chats')
        }}
        style={{ padding: 16, alignItems: 'center' }}
      >
        <Text style={{ color: t.accent }}>{tr('chat.backToList')}</Text>
      </Pressable>
      <Text style={{ color: t.text2, paddingHorizontal: 16 }}>{tr('chat.syncingMissing')}</Text>
    </View>
  )
}
