import React from 'react'
import { Text, View } from 'react-native'
import type { IMessage, InputToolbarProps } from '@kesha-antonov/react-native-chat'
import type { MessageKey, Translate } from '../../i18n'
import type { useProductChatTheme } from '../../ui/ProductChatTheme'
import { ProductInputToolbar } from '../ProductInputToolbar'

const ACCESS_PENDING: MessageKey = 'access.syncing'

/** The composer, or why this user cannot send here; while access is still syncing, a disabled composer. */
export function renderChatInputToolbar ({ accessNotice, selfID, theme, tr }: {
  accessNotice: MessageKey | ''
  tr: Translate
  selfID?: string
  theme: ReturnType<typeof useProductChatTheme>
}) {
  return (props: InputToolbarProps<IMessage>) =>
    accessNotice && accessNotice !== ACCESS_PENDING ? (
      <View style={{ minHeight: 56, padding: 12, justifyContent: 'center' }}>
        <Text style={{ textAlign: 'center', color: theme.colors.dayPillText, fontSize: 14 }}>
          {tr(accessNotice)}
        </Text>
      </View>
    ) : (
      <ProductInputToolbar {...props} selfID={selfID} accessPending={accessNotice === ACCESS_PENDING} />
    )
}
