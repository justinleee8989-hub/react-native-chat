import React, { useState } from 'react'
import { Text, View } from 'react-native'
import { changePassword } from '../application/profile'
import { logout, useOpenIM } from '../application/store'
import { SettingField, ProductHint } from '../groups/group-ui'
import { Confirm, Label } from '../shared/shared'
import { useTask } from '../shared/useTask'
import { ProductCard, ProductButton } from '../ui/primitives'
import { ProductSection, ProductInset } from '../ui/ProductPage'
import { useProductTheme } from '../ui/theme'

export default function PasswordForm () {
  const t = useProductTheme()
  const { session, config } = useOpenIM()
  const task = useTask()
  const [oldPassword, setOldPassword] = useState('')
  const [password, setPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  const [confirm, setConfirm] = useState(false)
  return (
    <>
      <ProductSection>修改密码</ProductSection>
      <ProductInset>
        <ProductCard>
          {[
            { label: '当前密码', value: oldPassword, setter: setOldPassword },
            { label: '新密码', value: password, setter: setPassword },
            { label: '确认新密码', value: repeat, setter: setRepeat },
          ].map(field => (
            <SettingField
              editable={!task.busy}
              key={field.label}
              accessibilityLabel={field.label}
              placeholder={field.label === '新密码' ? '新密码（至少 6 位）' : field.label}
              secureTextEntry
              autoCapitalize='none'
              value={field.value}
              onChangeText={field.setter}
            />
          ))}
        </ProductCard>
      </ProductInset>
      {!!repeat && password !== repeat ? (
        <Text
          style={{
            color: t.danger,
            fontSize: 13,
            lineHeight: 18,
            paddingHorizontal: 32,
            paddingTop: 8,
          }}
        >
          两次输入的密码不一致
        </Text>
      ) : (
        <ProductHint>修改成功会退出所有设备，请使用新密码重新登录。</ProductHint>
      )}
      {!!task.error && <Label>{task.error}</Label>}
      <View style={{ height: 24 }} />
      <ProductInset>
        <ProductButton
          title='修改密码'
          disabled={
            task.busy ||
            !oldPassword ||
            password.length < 6 ||
            password !== repeat ||
            password === oldPassword
          }
          onPress={() => setConfirm(true)}
        />
      </ProductInset>
      {confirm && (
        <Confirm
          title='确认修改密码并退出登录？'
          confirmLabel='修改'
          error={task.error}
          message=''
          busy={task.busy}
          onCancel={() => setConfirm(false)}
          onConfirm={() => {
            void task.run(async current => {
              if (!session)
                throw new Error('请重新登录')
              await changePassword(session, oldPassword, password, config.chat)
              if (current())
                await logout('密码已修改，请使用新密码登录')
            })
          }}
        />
      )}
    </>
  )
}
