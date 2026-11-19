import { Pressable, Text, View } from 'react-native'
import { isMessageKey, useT } from '../i18n'
import { useProductTheme } from '../ui/theme'
import type { AttachmentBatch } from './attachment-batch'

interface AttachmentBatchTrayProps {
  batches: AttachmentBatch[]
  onRetry: (batchID: string) => void | Promise<void>
  onCancel: (batchID: string) => void
}

export function AttachmentBatchTray ({ batches, onRetry, onCancel }: AttachmentBatchTrayProps) {
  const tr = useT()
  const colors = useProductTheme()
  const visible = batches.filter(
    batch => batch.status !== 'completed' && batch.status !== 'cancelled'
  )
  if (!visible.length)
    return null

  return (
    <View style={{ gap: 8, paddingHorizontal: 12, paddingVertical: 8 }}>
      {visible.map(batch => {
        const done = batch.items.filter(item => item.status === 'sent').length
        const total = batch.items.length
        const sending = batch.status === 'sending'
        const blocked = batch.status === 'blocked'
        return (
          <View
            key={batch.id}
            style={{ backgroundColor: colors.surface2, borderRadius: 12, padding: 12, gap: 8 }}
          >
            <Text style={{ color: colors.text, fontWeight: '500', fontSize: 13 }}>
              {blocked
                ? tr('attachments.paused')
                : sending
                  ? tr('attachments.sending', { done, total })
                  : tr('attachments.unfinished', { done, total })}
            </Text>
            {batch.error ? <Text style={{ color: colors.danger }}>{tr(isMessageKey(batch.error) ? batch.error : 'error.generic')}</Text> : null}
            {!sending ? (
              <View style={{ flexDirection: 'row', gap: 16 }}>
                {!blocked ? (
                  <Pressable accessibilityRole='button' onPress={() => void onRetry(batch.id)}>
                    <Text style={{ color: colors.accent, fontWeight: '500', fontSize: 13 }}>
                      {tr('attachments.continue')}
                    </Text>
                  </Pressable>
                ) : null}
                <Pressable accessibilityRole='button' onPress={() => onCancel(batch.id)}>
                  <Text style={{ color: colors.text2 }}>{tr('attachments.cancelRest')}</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        )
      })}
    </View>
  )
}
