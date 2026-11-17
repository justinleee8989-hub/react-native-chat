import React, { useState } from 'react'
import { View } from 'react-native'
import { type Href, useRouter } from 'expo-router'
import { openConversation, useOpenIM } from '../application/store'
import LoginScreen from '../auth/LoginScreen'
import { ProductHint, SettingField } from '../groups/group-ui'
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
  const router = useRouter()
  const [userID, setUserID] = useState('')
  const task = useTask()
  const start = () => {
    void task.run(async current => {
      const id = await openConversation(userID.trim())
      if (current())
        router.replace(`/chats/${encodeURIComponent(id)}` as Href)
    })
  }
  return (
    <ProductPage title='发起聊天' {...task} alwaysShowBack backHref='/(tabs)/chats'>
      <ProductSection>输入已注册的用户 ID</ProductSection>
      <ProductInset>
        <ProductCard>
          <SettingField
            placeholder='用户 ID'
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
      <ProductHint>请输入对方的完整用户 ID。</ProductHint>
      <View style={{ marginHorizontal: 16, marginTop: 24 }}>
        <ProductButton
          title={task.busy ? '正在打开…' : '打开会话'}
          disabled={task.busy || !userID.trim() || userID.trim() === self}
          onPress={start}
        />
      </View>
    </ProductPage>
  )
}
