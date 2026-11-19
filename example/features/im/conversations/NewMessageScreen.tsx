import React, { useState } from 'react'
import { View } from 'react-native'
import { type Href, useRouter } from 'expo-router'
import { directory } from '../application/directory'
import { openConversation, useOpenIM } from '../application/store'
import LoginScreen from '../auth/LoginScreen'
import { ProductHint, SettingField } from '../groups/group-ui'
import { useT } from '../i18n'
import { ProductError } from '../shared/product-error'
import { useTask } from '../shared/useTask'
import { ProductButton, ProductCard } from '../ui/primitives'
import { ProductInset, ProductPage, ProductSection } from '../ui/ProductPage'

export default function NewMessageScreen () {
  const { session } = useOpenIM()
  return session ? (
    <NewMessage key={`${session.userID}:${session.imToken}`} self={session.userID} />
  ) : (
    <LoginScreen />
  )
}
function NewMessage ({ self }: { self: string }) {
  const tr = useT()
  const router = useRouter()
  const [userID, setUserID] = useState('')
  const task = useTask()
  const start = () => {
    void task.run(async current => {
      const target = userID.trim()
      // The SDK opens a conversation with any ID, registered or not; a mistyped ID became a chat
      // that looked real and sent into nothing.
      const [person] = await directory.users(target)
      if (!current())
        return
      if (!person)
        throw new ProductError('newChat.notFound')
      const id = await openConversation(target)
      if (current())
        router.replace(`/chats/${encodeURIComponent(id)}` as Href)
    })
  }
  return (
    <ProductPage title={tr('newChat.title')} {...task} alwaysShowBack backHref='/(tabs)/chats'>
      <ProductSection>{tr('newChat.heading')}</ProductSection>
      <ProductInset>
        <ProductCard>
          <SettingField
            placeholder={tr('person.userID')}
            value={userID}
            onChangeText={setUserID}
            editable={!task.busy}
            onSubmitEditing={() => {
              if (userID.trim() && userID.trim() !== self)
                start()
            }}
          />
        </ProductCard>
      </ProductInset>
      <ProductHint>{tr('newChat.hint')}</ProductHint>
      <View style={{ marginHorizontal: 16, marginTop: 24 }}>
        <ProductButton
          title={task.busy ? tr('newChat.opening') : tr('newChat.open')}
          disabled={task.busy || !userID.trim() || userID.trim() === self}
          onPress={start}
        />
      </View>
    </ProductPage>
  )
}
