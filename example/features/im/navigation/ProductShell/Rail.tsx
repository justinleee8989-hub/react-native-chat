import React, { useEffect, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { profile } from '../../application/profile'
import { useOpenIM } from '../../application/store'
import type { SelfProfile } from '../../domain/profile'
import { useProductScheme, setProductAppearance, setPhonePreview } from '../../ui/preferences'
import { ProductAvatar } from '../../ui/primitives'
import { ProductIcon } from '../../ui/ProductIcon'
import { useProductTheme } from '../../ui/theme'
import type { ProductSection } from '../layout'
import { usePendingRequests } from '../usePendingRequests'
import { useRailNavigation } from '../useRailNavigation'
import { styles } from './styles'

const items = [
  { key: 'me', label: '我的', icon: 'user' },
  { key: 'chats', label: '消息', icon: 'chat' },
  { key: 'calls', label: '通话', icon: 'phone' },
  { key: 'contacts', label: '通讯录', icon: 'users' },
] as const

export function Rail ({ section }: { section: ProductSection }) {
  const pending = usePendingRequests()
  const navigate = useRailNavigation(section)
  const t = useProductTheme()
  const { conversations, session } = useOpenIM()
  const scheme = useProductScheme()
  const [self, setSelf] = useState<SelfProfile>()
  const userID = session?.userID
  const token = session?.imToken
  useEffect(() => {
    let current = true
    setSelf(undefined)
    if (userID && token)
      void profile
        .self()
        .then(value => {
          if (current && value.userID === userID)
            setSelf(value)
        })
        .catch(() => {})
    return () => {
      current = false
    }
  }, [userID, token])
  const unread = conversations.reduce((total, item) => total + (item.unreadCount || 0), 0)
  return (
    <View
      accessibilityLabel='导航'
      style={[styles.rail, { backgroundColor: t.bg, borderColor: t.line }]}
    >
      {items.map(item => (
        <Pressable
          key={item.key}
          accessibilityRole='tab'
          accessibilityLabel={item.label}
          accessibilityState={{ selected: section === item.key }}
          onPress={() => navigate(item.key)}
          style={[
            styles.railButton,
            {
              marginBottom: item.key === 'me' ? 10 : 0,
              backgroundColor:
                item.key !== 'me' && section === item.key ? t.accentWeak : 'transparent',
            },
          ]}
        >
          {item.key === 'me' ? (
            <View
              style={{
                padding: 2,
                borderWidth: 2,
                borderRadius: 24,
                borderColor: section === 'me' ? t.accent : 'transparent',
              }}
            >
              <ProductAvatar
                id={session?.userID || ''}
                title={self?.nickname || session?.userID || '我'}
                uri={self?.faceURL}
                size={40}
              />
            </View>
          ) : (
            <ProductIcon
              name={item.icon}
              size={24}
              color={section === item.key ? t.accent : t.text2}
            />
          )}
          {(item.key === 'chats' ? unread : item.key === 'contacts' ? pending : 0) > 0 && (
            <Text style={[styles.badge, { backgroundColor: t.danger }]}>
              {(item.key === 'chats' ? unread : pending) > 99
                ? '99+'
                : item.key === 'chats'
                  ? unread
                  : pending}
            </Text>
          )}
        </Pressable>
      ))}
      <View style={{ flex: 1 }} />
      <Pressable
        accessibilityRole='button'
        accessibilityLabel='切换外观'
        onPress={() => setProductAppearance(scheme === 'dark' ? 'light' : 'dark')}
        style={styles.railButton}
      >
        <ProductIcon name={scheme === 'dark' ? 'sun' : 'moon'} color={t.text2} />
      </Pressable>
      <Pressable
        accessibilityRole='button'
        accessibilityLabel='手机预览'
        onPress={() => setPhonePreview(true)}
        style={styles.railButton}
      >
        <ProductIcon name='device' color={t.text2} />
      </Pressable>
    </View>
  )
}
