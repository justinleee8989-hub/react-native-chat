import React, { useState } from 'react'
import { View } from 'react-native'
import { useRouter } from 'expo-router'
import { groupManagement } from '../application/group-management'
import { useOpenIM } from '../application/store'
import LoginScreen from '../auth/LoginScreen'
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
  const router = useRouter()
  const task = useTask()
  const [id, setID] = useState('')
  const [reason, setReason] = useState('')
  const [confirm, setConfirm] = useState<{ id: string, reason: string }>()
  return (
    <ProductPage title='通过群 ID 加群' {...task}>
      <ProductSection>群信息</ProductSection>
      <ProductInset>
        <ProductCard>
          <SettingField
            editable={!task.busy}
            label='群 ID'
            value={id}
            onChangeText={setID}
            placeholder='输入群 ID'
          />
          <SettingField
            editable={!task.busy}
            label='申请理由'
            value={reason}
            onChangeText={setReason}
            placeholder='选填'
          />
        </ProductCard>
      </ProductInset>
      <ProductHint>是否需要审核由群设置决定。提交后可在「入群申请」中查看结果。</ProductHint>
      <View style={{ height: 24 }} />
      <ProductInset>
        <ProductButton
          title='申请加群'
          disabled={task.busy || !id.trim()}
          onPress={() => setConfirm({ id: id.trim(), reason })}
        />
      </ProductInset>
      {confirm && (
        <Confirm
          error={task.error}
          busy={task.busy}
          title={`确认申请加入群 ${confirm.id}？`}
          message=''
          confirmLabel='申请'
          danger={false}
          onCancel={() => setConfirm(undefined)}
          onConfirm={() => {
            void task.run(async current => {
              await groupManagement.join(confirm.id, confirm.reason)
              if (current()) {
                setConfirm(undefined)
                setID('')
                setReason('')
                showProductToast('申请已提交，等待群主或管理员处理')
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
