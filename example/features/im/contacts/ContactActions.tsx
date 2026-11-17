import React, { useState } from 'react'
import { Text } from 'react-native'
import * as Crypto from 'expo-crypto'
import { type Href, useRouter } from 'expo-router'
import { directory } from '../application/directory'
import { profile } from '../application/profile'
import { calls, openConversation } from '../application/store'
import type { Person } from '../domain/directory'
import { ProductPromptField } from '../shared/ProductPromptField'
import { Confirm } from '../shared/shared'
import { useTask } from '../shared/useTask'
import { ProductSheet } from '../ui/primitives'
import { useProductTheme } from '../ui/theme'

export function ContactActions ({
  person,
  onClose,
  onChanged,
}: {
  person: Person
  onClose: () => void
  onChanged: () => void
}) {
  const router = useRouter()
  const t = useProductTheme()
  const task = useTask()
  const [mode, setMode] = useState<'menu' | 'remark' | 'delete'>('menu')
  const [remark, setRemark] = useState(person.remark || '')
  const name = person.remark || person.nickname || person.userID
  if (mode === 'delete')
    return (
      <Confirm
        title={`删除好友 ${name}？`}
        message='删除后需要重新申请才能添加。'
        confirmLabel='删除'
        busy={task.busy}
        error={task.error}
        onCancel={onClose}
        onConfirm={() => {
          void task.run(async current => {
            await directory.removeFriend(person.userID)
            if (current()) {
              onChanged()
              onClose()
            }
          })
        }}
      />
    )
  if (mode === 'remark')
    return (
      <Confirm
        title='设置备注'
        message=''
        confirmLabel='保存'
        danger={false}
        busy={task.busy}
        error={task.error}
        onCancel={onClose}
        onConfirm={() => {
          void task.run(async current => {
            await profile.remark(person.userID, remark)
            if (current()) {
              onChanged()
              onClose()
            }
          })
        }}
      >
        <ProductPromptField
          accessibilityLabel='好友备注'
          placeholder='留空则清除备注'
          value={remark}
          onChangeText={setRemark}
          editable={!task.busy}
        />
      </Confirm>
    )
  return (
    <ProductSheet
      title={name}
      busy={task.busy}
      onClose={onClose}
      items={[
        {
          title: '发消息',
          onPress: () => {
            void task.run(async current => {
              const id = await openConversation(person.userID)
              if (current()) {
                onClose()
                router.push(`/chats/${encodeURIComponent(id)}` as Href)
              }
            })
          },
        },
        {
          title: '音视频通话',
          onPress: () => {
            void task.run(async current => {
              await calls.start(person.userID, name, `imcall-${Crypto.randomUUID()}`)
              if (current())
                onClose()
            })
          },
        },
        ...(person.isFriend
          ? [
            { title: '设置备注', onPress: () => setMode('remark') },
            { title: '删除好友', danger: true, onPress: () => setMode('delete') },
          ]
          : []),
      ]}
    >
      {!!task.error && (
        <Text accessibilityRole='alert' style={{ color: t.danger }}>
          {task.error}
        </Text>
      )}
    </ProductSheet>
  )
}
