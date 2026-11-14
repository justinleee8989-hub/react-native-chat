import React, { useState } from 'react'
import { TextInput } from 'react-native'
import { useChatListColors } from '@/components/chat-list/theme'
import { changePassword } from '../application/profile'
import { logout, useOpenIM } from '../application/store'
import { Action, Confirm, Label, styles } from '../shared/shared'
import { useTask } from '../shared/useTask'

export default function PasswordForm () {
  const { session, config } = useOpenIM()
  const colors = useChatListColors()
  const task = useTask()
  const [oldPassword, setOldPassword] = useState('')
  const [password, setPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  const [confirm, setConfirm] = useState(false)
  return <>
    <Label>修改密码</Label>
    <Label>修改成功会退出所有设备。请使用新密码重新登录。</Label>
    {[
      { label: '当前密码', value: oldPassword, setter: setOldPassword },
      { label: '新密码', value: password, setter: setPassword },
      { label: '确认新密码', value: repeat, setter: setRepeat },
    ].map(field => <TextInput key={field.label} accessibilityLabel={field.label} placeholder={field.label} placeholderTextColor={colors.message} secureTextEntry autoCapitalize='none' value={field.value} onChangeText={field.setter} style={[styles.input, { color: colors.name, borderColor: colors.divider }]} />)}
    {!!task.error && <Label>{task.error}</Label>}
    {!!repeat && password !== repeat && <Label>两次新密码不一致</Label>}
    <Action title='修改密码' danger disabled={task.busy || !oldPassword || !password || password !== repeat || password === oldPassword} onPress={() => setConfirm(true)} />
    {confirm && <Confirm message='确认修改密码并退出登录？' busy={task.busy} onCancel={() => setConfirm(false)} onConfirm={() => {
      void task.run(async current => {
        if (!session)
          throw new Error('请重新登录')
        await changePassword(session, oldPassword, password, config.chat)
        if (current())
          await logout('密码已修改，请使用新密码登录')
      })
    }}
    />}
  </>
}
