import React, { useState } from 'react'
import { Modal, Text, View } from 'react-native'
import { ChatList } from '@kesha-antonov/react-native-chat'
import { useChatListColors } from '@/components/chat-list/theme'
import { forwardMessage, useOpenIM } from '@/features/im/application/store'
import LoginScreen from '@/features/im/auth/LoginScreen'
import { toChat } from '@/features/im/domain/model'
import type { Conversation, IMMessage } from '@/features/im/domain/types'
import { Action, Confirm } from '@/features/im/shared/shared'
import { useTask } from '@/features/im/shared/useTask'

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
  const colors = useChatListColors()
  const task = useTask()
  const [target, setTarget] = useState<Conversation>()
  return (
    <Modal visible animationType='slide' onRequestClose={onClose}>
      <View style={{ flex: 1, paddingTop: 56, backgroundColor: colors.background }}>
        <Action title='取消转发' onPress={onClose} disabled={task.busy} />
        <Text style={{ color: colors.name, padding: 16 }}>选择转发到的会话</Text>
        {!!task.error && <Text accessibilityRole='alert' style={{ color: colors.draft }}>{task.error}</Text>}
        {target && <Confirm message={`转发给 ${target.showName}？`} busy={task.busy}
          onCancel={() => setTarget(undefined)} onConfirm={() => {
            void task.run(async current => {
              await forwardMessage(target.conversationID, message)
              if (current()) 
                onClose()
            }) 
          }}
        />}
        <ChatList locale='zh-CN' chats={state.conversations.map(conversation => toChat(conversation, state.session?.userID))} onPressChat={chat => {
          if (!task.busy) 
            setTarget(state.conversations.find(item => item.conversationID === chat.id))
        }}
        />
      </View>
    </Modal>
  )
}
