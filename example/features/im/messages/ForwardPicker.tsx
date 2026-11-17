import React, { useState } from 'react'
import { ScrollView, Text } from 'react-native'
import { forwardMessage, useOpenIM } from '@/features/im/application/store'
import LoginScreen from '@/features/im/auth/LoginScreen'
import type { Conversation, IMMessage } from '@/features/im/domain/types'
import { Confirm } from '@/features/im/shared/shared'
import { useTask } from '@/features/im/shared/useTask'
import { ProductAvatar } from '../ui/primitives'
import { ProductListRow } from '../ui/ProductListRow'
import { useProductTheme } from '../ui/theme'
import { ProductPickerModal } from './ProductPickerModal'

interface Props {
  message: IMMessage
  onClose: () => void
}

export default function ForwardPicker (props: Props) {
  const { session } = useOpenIM()
  if (!session)
    return <LoginScreen />
  return <SessionForwardPicker key={`${session.userID}:${session.imToken}`} {...props} />
}

function SessionForwardPicker ({ message, onClose }: Props) {
  const state = useOpenIM()
  const t = useProductTheme()
  const task = useTask()
  const [target, setTarget] = useState<Conversation>()
  const close = () => {
    if (!task.busy)
      onClose()
  }
  const conversations = state.conversations
  return (
    <ProductPickerModal title='转发给' onClose={close} busy={task.busy}>
      {!!task.error && (
        <Text accessibilityRole='alert' style={{ color: t.danger, padding: 16 }}>
          {task.error}
        </Text>
      )}
      <ScrollView keyboardShouldPersistTaps='handled'>
        {conversations.map((item, index) => (
          <ProductListRow
            backgroundColor='transparent'
            small
            last={index === conversations.length - 1}
            key={item.conversationID}
            title={item.showName}
            leading={
              <ProductAvatar
                group={!!item.groupID}
                id={item.groupID || item.userID || item.conversationID}
                title={item.showName}
                uri={item.faceURL}
                size={44}
              />
            }
            onPress={() => {
              if (!task.busy)
                setTarget(item)
            }}
          />
        ))}
        {!conversations.length && (
          <Text
            style={{
              color: t.text3,
              textAlign: 'center',
              paddingVertical: 72,
              paddingHorizontal: 40,
            }}
          >
            暂无会话
          </Text>
        )}
      </ScrollView>
      {target && (
        <Confirm
          error={task.error}
          danger={false}
          confirmLabel='转发'
          title={`转发给 ${target.showName}？`}
          message=''
          busy={task.busy}
          onCancel={() => setTarget(undefined)}
          onConfirm={() => {
            void task.run(async current => {
              await forwardMessage(target.conversationID, message)
              if (current())
                onClose()
            })
          }}
        />
      )}
    </ProductPickerModal>
  )
}
