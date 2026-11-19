import React, { useState } from 'react'
import * as Crypto from 'expo-crypto'
import { type Href, useRouter } from 'expo-router'
import { directory } from '../application/directory'
import { profile } from '../application/profile'
import { calls, openConversation } from '../application/store'
import type { Person } from '../domain/directory'
import { useT } from '../i18n'
import { ProductPromptField } from '../shared/ProductPromptField'
import { Confirm } from '../shared/shared'
import { useTask } from '../shared/useTask'
import { ProductSheet } from '../ui/primitives'

export function ContactActions ({
  person,
  onClose,
  onChanged,
}: {
  person: Person
  onClose: () => void
  onChanged: () => void
}) {
  const tr = useT()
  const router = useRouter()
  const task = useTask()
  const [mode, setMode] = useState<'menu' | 'remark' | 'delete'>('menu')
  const [remark, setRemark] = useState(person.remark || '')
  const name = person.remark || person.nickname || person.userID
  if (mode === 'delete')
    return (
      <Confirm
        title={tr('contacts.deleteFriendTitle', { name })}
        message={tr('contacts.deleteFriendMessage')}
        confirmLabel={tr('contacts.removeConfirm')}
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
        title={tr('contacts.setRemark')}
        message=''
        confirmLabel={tr('common.save')}
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
          accessibilityLabel={tr('contacts.remark')}
          placeholder={tr('contacts.remarkClearHint')}
          value={remark}
          onChangeText={setRemark}
          editable={!task.busy}
        />
      </Confirm>
    )
  return (
    <ProductSheet
      error={task.error}
      title={name}
      busy={task.busy}
      onClose={onClose}
      items={[
        {
          title: tr('contacts.message'),
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
          title: tr('contacts.call'),
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
            { title: tr('contacts.setRemark'), onPress: () => setMode('remark') },
            { title: tr('contacts.deleteFriend'), danger: true, onPress: () => setMode('delete') },
          ]
          : []),
      ]}
    >
    </ProductSheet>
  )
}
