import React, { useEffect, useState } from 'react'
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native'
import { listGroupMembers } from '../infrastructure/openim/composer-client'
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
  const t = useProductTheme()
  const [members, setMembers] = useState<ComposerMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let current = true
    setLoading(true)
    setError('')
    void listGroupMembers(groupID)
      .then(value => {
        if (current) {
          setMembers(value)
          setLoading(false)
        }
      })
      .catch(failure => {
        if (current) {
          setError(failure instanceof Error ? failure.message : '群成员加载失败')
          setLoading(false)
        }
      })
    return () => {
      current = false
    }
  }, [groupID, attempt])
  return (
    <ProductPickerModal title='提醒群成员' onClose={onClose}>
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
              item.roleLevel === 100 ? '群主' : (item.roleLevel || 0) >= 60 ? '管理员' : '成员'
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
                {error || '没有可提醒的群成员'}
              </Text>
            )}
            {!!error && (
              <Pressable accessibilityRole='button' onPress={() => setAttempt(value => value + 1)} style={{ padding: 12 }}>
                <Text style={{ color: t.accent }}>重新加载</Text>
              </Pressable>
            )}
          </View>
        }
      />
    </ProductPickerModal>
  )
}
