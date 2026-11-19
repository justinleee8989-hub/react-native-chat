import React, { useState } from 'react'
import { View } from 'react-native'
import { useRouter } from 'expo-router'
import { groupManagement } from '../application/group-management'
import { useOpenIM } from '../application/store'
import LoginScreen from '../auth/LoginScreen'
import { useT } from '../i18n'
import { showProductToast } from '../shared/ProductToast'
import { Confirm } from '../shared/shared'
import { useTask } from '../shared/useTask'
import { ProductCard, ProductButton } from '../ui/primitives'
import { ProductPage, ProductInset, ProductSection } from '../ui/ProductPage'
import { SettingField, ProductHint } from './group-ui'

export default function JoinGroupScreen () {
  const { session } = useOpenIM()
  return session ? <JoinGroup key={`${session.userID}:${session.imToken}`} /> : <LoginScreen />
}
function JoinGroup () {
  const tr = useT()
  const router = useRouter()
  const task = useTask()
  const [id, setID] = useState('')
  const [reason, setReason] = useState('')
  const [confirm, setConfirm] = useState<{ id: string, reason: string }>()
  return (
    <ProductPage title={tr('chats.joinGroupByID')} {...task}>
      <ProductSection>{tr('join.groupInfo')}</ProductSection>
      <ProductInset>
        <ProductCard>
          <SettingField
            editable={!task.busy}
            label={tr('group.id')}
            value={id}
            onChangeText={setID}
            placeholder={tr('join.enterID')}
          />
          <SettingField
            editable={!task.busy}
            label={tr('join.reason')}
            value={reason}
            onChangeText={setReason}
            placeholder={tr('join.optional')}
          />
        </ProductCard>
      </ProductInset>
      <ProductHint>{tr('join.hint')}</ProductHint>
      <View style={{ height: 24 }} />
      <ProductInset>
        <ProductButton
          title={tr('join.apply')}
          disabled={task.busy || !id.trim()}
          onPress={() => setConfirm({ id: id.trim(), reason })}
        />
      </ProductInset>
      {confirm && (
        <Confirm
          error={task.error}
          busy={task.busy}
          title={tr('join.confirmTitle', { id: confirm.id })}
          message=''
          confirmLabel={tr('join.confirm')}
          danger={false}
          onCancel={() => setConfirm(undefined)}
          onConfirm={() => {
            void task.run(async current => {
              await groupManagement.join(confirm.id, confirm.reason)
              if (current()) {
                setConfirm(undefined)
                setID('')
                setReason('')
                showProductToast(tr('join.submitted'))
                if (router.canGoBack())
                  router.back()
                else
                  router.replace('/chats/groups')
              }
            })
          }}
        />
      )}
    </ProductPage>
  )
}
