import React from 'react'
import { Button, Text, View } from 'react-native'
import { styles } from './styles'

/** The alerts above the message list: access, the last action, the draft, the store, locating. */
export function ChatNotices ({
  accessError,
  onRetryAccess,
  taskError,
  draftError,
  onRetryDraft,
  storeError,
  locating,
}: {
  accessError?: string
  onRetryAccess: () => void
  taskError?: string
  draftError: boolean
  onRetryDraft: () => void
  storeError?: string
  locating: boolean
}) {
  return (
    <>
      {!!accessError && (
        <View>
          <Text accessibilityRole='alert' style={styles.error}>
            {accessError}
          </Text>
          <Button title='重试同步会话权限' onPress={onRetryAccess} />
        </View>
      )}
      {!!taskError && (
        <Text accessibilityRole='alert' style={styles.error}>
          {taskError}
        </Text>
      )}
      {draftError && (
        <View>
          <Text accessibilityRole='alert' style={styles.error}>
            草稿恢复失败，当前输入已保留
          </Text>
          <Button title='重试恢复草稿' onPress={onRetryDraft} />
        </View>
      )}
      {!!storeError && (
        <Text accessibilityRole='alert' style={styles.error}>
          {storeError}
        </Text>
      )}
      {locating && <Text accessibilityRole='text'>正在定位消息…</Text>}
    </>
  )
}
