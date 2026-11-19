import React from 'react'
import { Text, View } from 'react-native'
import { useT } from '../../i18n'
import { ProductPressable as Pressable } from '../../ui/ProductPressable'
import { useProductTheme } from '../../ui/theme'
import { styles } from './styles'

/** A retry under a notice: the accent-colored text button the app's pages use. */
function Retry ({ title, onPress }: { title: string, onPress: () => void }) {
  const t = useProductTheme()
  return (
    <Pressable accessibilityRole='button' accessibilityLabel={title} onPress={onPress} style={{ padding: 12, alignItems: 'center' }}>
      <Text style={{ color: t.accent }}>{title}</Text>
    </Pressable>
  )
}

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
  const t = useProductTheme()
  const alert = [styles.notice, { color: t.danger }]
  return (
    <>
      {!!accessError && (
        <View>
          <Text accessibilityRole='alert' style={alert}>
            {accessError}
          </Text>
          <Retry title={tr('access.retry')} onPress={onRetryAccess} />
        </View>
      )}
      {!!taskError && (
        <Text accessibilityRole='alert' style={alert}>
          {taskError}
        </Text>
      )}
      {draftError && (
        <View>
          <Text accessibilityRole='alert' style={alert}>
            {tr('composer.draftRestoreKept')}
          </Text>
          <Retry title={tr('composer.retryDraft')} onPress={onRetryDraft} />
        </View>
      )}
      {!!storeError && (
        <Text accessibilityRole='alert' style={alert}>
          {storeError}
        </Text>
      )}
      {locating && <Text accessibilityRole='text' style={[styles.notice, { color: t.text2 }]}>{tr('chat.locating')}</Text>}
    </>
  )
}
