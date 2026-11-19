import React from 'react'
import { Button, Text, View } from 'react-native'
import { useT } from '../../i18n'
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
  const tr = useT()
  return (
    <>
      {!!accessError && (
        <View>
          <Text accessibilityRole='alert' style={styles.error}>
            {accessError}
          </Text>
          <Button title={tr('access.retry')} onPress={onRetryAccess} />
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
            {tr('composer.draftRestoreKept')}
          </Text>
          <Button title={tr('composer.retryDraft')} onPress={onRetryDraft} />
        </View>
      )}
      {!!storeError && (
        <Text accessibilityRole='alert' style={styles.error}>
          {storeError}
        </Text>
      )}
      {locating && <Text accessibilityRole='text'>{tr('chat.locating')}</Text>}
    </>
  )
}
