import React from 'react'
import { Text, View } from 'react-native'
import type { IMessage, InputToolbarProps } from '@kesha-antonov/react-native-chat'
import type { useProductChatTheme } from '../../ui/ProductChatTheme'
import { ProductInputToolbar } from '../ProductInputToolbar'

const ACCESS_PENDING = '正在同步会话权限…'

/** The composer, or why this user cannot send here; while access is still syncing, a disabled composer. */
export function renderChatInputToolbar ({ accessNotice, selfID, theme }: {
  accessNotice: string
  selfID?: string
  theme: ReturnType<typeof useProductChatTheme>
}) {
  return (props: InputToolbarProps<IMessage>) =>
    accessNotice && accessNotice !== ACCESS_PENDING ? (
      <View style={{ minHeight: 56, padding: 12, justifyContent: 'center' }}>
        <Text style={{ textAlign: 'center', color: theme.colors.dayPillText, fontSize: 14 }}>
          {accessNotice}
        </Text>
      </View>
    ) : (
      <ProductInputToolbar {...props} selfID={selfID} accessPending={accessNotice === ACCESS_PENDING} />
    )
}
