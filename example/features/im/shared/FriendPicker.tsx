import React, { useEffect, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { directory } from '@/features/im/application/directory'
import { mergeDirectory, type Person } from '@/features/im/domain/directory'
import { useTask } from '@/features/im/shared/useTask'
import { ProductHint } from '../groups/group-ui'
import { useT } from '../i18n'
import { ProductAvatar, ProductCard } from '../ui/primitives'
import { ProductIcon } from '../ui/ProductIcon'
import { ProductSection, ProductInset, ProductEmpty } from '../ui/ProductPage'
import { productRowSeparatorStyle } from '../ui/ProductRowSeparator'
import { useProductTheme } from '../ui/theme'
import { Action } from './shared'

export function FriendPicker ({
  selected,
  onChange,
  disabled = false,
  excluded = [],
  inviting = false,
}: {
  excluded?: string[]
  inviting?: boolean
  selected: string[]
  onChange: (ids: string[]) => void
  disabled?: boolean
}) {
  const tr = useT()
  const t = useProductTheme()
  const [people, setPeople] = useState<Person[]>([])
  const [offset, setOffset] = useState(0)
  const [more, setMore] = useState(true)
  const { run, busy, error } = useTask()
  useEffect(() => {
    void run(async current => {
      const page = await directory.friends()
      if (current()) {
        setPeople(page)
        setOffset(page.length)
        setMore(page.length === 30)
      }
    })
  }, [run])
  const visible = people.filter(person => !excluded.includes(person.userID))
  return (
    <>
      <ProductSection>{tr('friendPicker.title', { count: selected.length })}</ProductSection>
      {(!inviting || visible.length > 0) && (
        <ProductInset>
          <ProductCard>
            {visible.map((person, index, visible) => (
              <Pressable
                key={person.userID}
                accessibilityRole='checkbox'
                accessibilityLabel={person.remark || person.nickname || person.userID}
                accessibilityState={{ checked: selected.includes(person.userID), disabled }}
                disabled={disabled}
                onPress={() =>
                  onChange(
                    selected.includes(person.userID)
                      ? selected.filter(id => id !== person.userID)
                      : [...selected, person.userID]
                  )
                }
                style={{
                  minHeight: 64,
                  paddingHorizontal: 20,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 14,
                }}
              >
                <View
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 11,
                    borderWidth: selected.includes(person.userID) ? 0 : 1.5,
                    borderColor: t.text3,
                    backgroundColor: selected.includes(person.userID) ? t.accent : 'transparent',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {selected.includes(person.userID) && (
                    <ProductIcon name='check' size={16} color='#fff' />
                  )}
                </View>
                <ProductAvatar
                  id={person.userID}
                  title={person.remark || person.nickname || person.userID}
                  uri={person.faceURL}
                  size={44}
                />
                <View
                  style={[
                    { alignSelf: 'stretch', flex: 1, justifyContent: 'center' },
                    productRowSeparatorStyle(index !== visible.length - 1, t.line),
                  ]}
                >
                  <Text style={{ color: t.text, fontSize: 16, fontWeight: '600' }}>
                    {person.remark || person.nickname || person.userID}
                  </Text>
                </View>
              </Pressable>
            ))}
            {!busy && !inviting && !visible.length && <ProductEmpty title={tr('friendPicker.noFriends')} />}
          </ProductCard>
        </ProductInset>
      )}
      {inviting && !busy && !visible.length && (
        <ProductEmpty title={tr('friendPicker.noneToInvite')} subtitle={tr('friendPicker.allInGroup')} />
      )}
      {!!error && <ProductHint error>{error}</ProductHint>}
      {more && (
        <Action
          title={busy ? tr('common.loading') : tr('friendPicker.loadMore')}
          disabled={busy || disabled}
          onPress={() => {
            void run(async current => {
              const page = await directory.friends(offset)
              if (current()) {
                setPeople(items => mergeDirectory(items, page, item => item.userID))
                setOffset(offset + page.length)
                setMore(page.length === 30)
              }
            })
          }}
        />
      )}
    </>
  )
}
