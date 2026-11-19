import React, { useEffect, useState } from 'react'
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native'
import { useT } from '../i18n'
import { listGroupMembers } from '../infrastructure/openim/composer-client'
import { errorMessage } from '../shared/error-message'
import { ProductError } from '../shared/product-error'
import { ProductAvatar } from '../ui/primitives'
import { ProductListRow } from '../ui/ProductListRow'
import { useProductTheme } from '../ui/theme'
import type { ComposerMember } from './ComposerEnhancements'
import { ProductPickerModal } from './ProductPickerModal'

export function MentionPicker ({
  groupID,
  onClose,
  onSelect,
}: {
  groupID: string
  onClose: () => void
  onSelect: (member: ComposerMember) => void
}) {
  const tr = useT()
  const t = useProductTheme()
  const [members, setMembers] = useState<ComposerMember[]>([])
  const [loading, setLoading] = useState(true)
  const [failure, setFailure] = useState<unknown>()
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let current = true
    setLoading(true)
    setFailure(undefined)
    void listGroupMembers(groupID)
      .then(value => {
        if (current) {
          setMembers(value)
          setLoading(false)
        }
      })
      .catch(failure => {
        if (current) {
          setFailure(failure || new ProductError('mention.loadFailed'))
          setLoading(false)
        }
      })
    return () => {
      current = false
    }
  }, [groupID, attempt])
  const error = failure ? errorMessage(failure, tr) : ''
  return (
    <ProductPickerModal title={tr('mention.title')} onClose={onClose}>
      <FlatList
        data={members}
        keyExtractor={member => member.userID}
        renderItem={({ item, index }) => (
          <ProductListRow
            backgroundColor={t.bg}
            small
            last={index === members.length - 1}
            title={item.nickname}
            subtitle={
              item.roleLevel === 100 ? tr('role.owner') : (item.roleLevel || 0) >= 60 ? tr('role.admin') : tr('role.memberShort')
            }
            leading={
              <ProductAvatar id={item.userID} title={item.nickname} uri={item.faceURL} size={44} />
            }
            onPress={() => {
              onSelect(item)
              onClose()
            }}
          />
        )}
        ListEmptyComponent={
          <View style={{ paddingVertical: 72, paddingHorizontal: 40, alignItems: 'center' }}>
            {loading ? (
              <ActivityIndicator color={t.accent} />
            ) : (
              <Text style={{ color: error ? t.danger : t.text3 }}>
                {error || tr('mention.none')}
              </Text>
            )}
            {!!error && (
              <Pressable accessibilityRole='button' onPress={() => setAttempt(value => value + 1)} style={{ padding: 12 }}>
                <Text style={{ color: t.accent }}>{tr('common.reload')}</Text>
              </Pressable>
            )}
          </View>
        }
      />
    </ProductPickerModal>
  )
}
