import React, { useState } from 'react'
import { Href, useRouter } from 'expo-router'
import { directory } from '../application/directory'
import { openConversation, refresh, useOpenIM } from '../application/store'
import LoginScreen from '../auth/LoginScreen'
import { useT } from '../i18n'
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
  const tr = useT()
  const router = useRouter()
  const task = useTask()
  const [name, setName] = useState('')
  const [createdID, setCreatedID] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  return (
    <ProductPage
      title={tr('chats.createGroup')}
      {...task}
      right={
        <HeaderAction
          title={createdID ? tr('createGroup.open') : tr('createGroup.create')}
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
                showProductToast(tr('notice.groupCreated'))
                router.replace(`/chats/${encodeURIComponent(id)}` as Href)
              }
            })
          }}
        />
      }
    >
      <ProductSection>{tr('createGroup.name')}</ProductSection>
      <ProductInset>
        <ProductCard>
          <SettingField
            editable={!task.busy && !createdID}
            value={name}
            onChangeText={setName}
            placeholder={tr('createGroup.namePlaceholder')}
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
