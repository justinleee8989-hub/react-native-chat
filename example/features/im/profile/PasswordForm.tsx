import React, { useState } from 'react'
import { View } from 'react-native'
import { changePassword } from '../application/profile'
import { logout, useOpenIM } from '../application/store'
import { SettingField, ProductHint } from '../groups/group-ui'
import { useT } from '../i18n'
import { ProductError } from '../shared/product-error'
import { Confirm } from '../shared/shared'
import { useTask } from '../shared/useTask'
import { ProductCard, ProductButton } from '../ui/primitives'
import { ProductSection, ProductInset } from '../ui/ProductPage'

export default function PasswordForm () {
  const tr = useT()
  const { session, config } = useOpenIM()
  const task = useTask()
  const [oldPassword, setOldPassword] = useState('')
  const [password, setPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  const [confirm, setConfirm] = useState(false)
  return (
    <>
      <ProductSection>{tr('password.title')}</ProductSection>
      <ProductInset>
        <ProductCard>
          {[
            { label: tr('password.current'), value: oldPassword, setter: setOldPassword },
            { label: tr('auth.newPassword'), value: password, setter: setPassword },
            { label: tr('auth.confirmNewPassword'), value: repeat, setter: setRepeat },
          ].map(field => (
            <SettingField
              editable={!task.busy}
              key={field.label}
              accessibilityLabel={field.label}
              placeholder={field.label === tr('auth.newPassword') ? tr('auth.newPasswordHint') : field.label}
              secureTextEntry
              autoCapitalize='none'
              value={field.value}
              onChangeText={field.setter}
            />
          ))}
        </ProductCard>
      </ProductInset>
      {/* One line under the fields: what is wrong, or else what changing it does. */}
      {(!!repeat && password !== repeat) || task.error ? (
        <ProductHint error>
          {!!repeat && password !== repeat ? tr('auth.passwordMismatch') : task.error}
        </ProductHint>
      ) : (
        <ProductHint>{tr('password.signOutEverywhere')}</ProductHint>
      )}
      <View style={{ height: 24 }} />
      <ProductInset>
        <ProductButton
          title={tr('password.title')}
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
          title={tr('password.confirmTitle')}
          confirmLabel={tr('password.confirm')}
          error={task.error}
          message=''
          busy={task.busy}
          onCancel={() => setConfirm(false)}
          onConfirm={() => {
            void task.run(async current => {
              if (!session)
                throw new ProductError('password.signInAgain')
              await changePassword(session, oldPassword, password, config.chat)
              if (current())
                await logout('password.changed')
            })
          }}
        />
      )}
    </>
  )
}
