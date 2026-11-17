import React, { useState } from 'react'
import { Href, useRouter } from 'expo-router'
import { directory } from '../application/directory'
import { openConversation, refresh, useOpenIM } from '../application/store'
import LoginScreen from '../auth/LoginScreen'
import { FriendPicker } from '../shared/FriendPicker'
import { showProductToast } from '../shared/ProductToast'
import { useTask } from '../shared/useTask'
import { ProductCard } from '../ui/primitives'
import { ProductPage, ProductSection, ProductInset } from '../ui/ProductPage'
import { HeaderAction, SettingField } from './group-ui'
export default function CreateGroupScreen () {
  const { session } = useOpenIM()
  return session ? <CreateGroup key={`${session.userID}:${session.imToken}`} /> : <LoginScreen />
}
function CreateGroup () {
  const router = useRouter()
  const task = useTask()
  const [name, setName] = useState('')
  const [createdID, setCreatedID] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  return (
    <ProductPage
      title='创建群聊'
      {...task}
      right={
        <HeaderAction
          title={createdID ? '打开群聊' : '创建'}
          disabled={task.busy || !name.trim() || !selected.length}
          onPress={() => {
            void task.run(async current => {
              const groupID = createdID || (await directory.create(name.trim(), selected)).groupID
              if (!current())
                return
              setCreatedID(groupID)
              await refresh()
              if (!current())
                return
              const id = await openConversation(groupID, 3)
              if (current()) {
                showProductToast('群聊已创建')
                router.replace(`/chats/${encodeURIComponent(id)}` as Href)
              }
            })
          }}
        />
      }
    >
      <ProductSection>群名称</ProductSection>
      <ProductInset>
        <ProductCard>
          <SettingField
            editable={!task.busy && !createdID}
            value={name}
            onChangeText={setName}
            placeholder='给群聊起个名字'
          />
        </ProductCard>
      </ProductInset>
      <FriendPicker
        selected={selected}
        onChange={setSelected}
        disabled={task.busy || !!createdID}
      />
    </ProductPage>
  )
}
