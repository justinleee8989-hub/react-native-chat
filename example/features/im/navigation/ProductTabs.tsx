import React from 'react'
import { Tabs } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useOpenIM } from '../application/store'
import { useT } from '../i18n'
import { useProductLayout } from '../ui/preferences'
import { ProductIcon } from '../ui/ProductIcon'
import { useProductColors } from '../ui/theme'
import ProductShell from './ProductShell'
import { usePendingRequests } from './usePendingRequests'

export default function ProductTabs () {
  const tr = useT()
  const { desktop } = useProductLayout()
  const pending = usePendingRequests(!desktop)
  const insets = useSafeAreaInsets()
  const colors = useProductColors()
  const { session, conversations } = useOpenIM()
  const unread = conversations.reduce(
    (total, conversation) => total + (conversation.unreadCount || 0),
    0
  )
  if (!session)
    return null
  return (
    <ProductShell master>
      <Tabs
        backBehavior='initialRoute'
        screenOptions={{
          headerShown: false,
          tabBarPosition: 'bottom',
          tabBarActiveTintColor: colors.badge,
          tabBarInactiveTintColor: colors.date,
          tabBarStyle: {
            display: desktop ? 'none' : 'flex',
            height: 60 + insets.bottom,
            backgroundColor: colors.headerBackground,
            borderColor: colors.divider,
          },
          tabBarLabelStyle: { fontSize: 10.5, fontWeight: '500' },
          sceneStyle: { backgroundColor: colors.background },
        }}
      >
        <Tabs.Screen
          name='chats'
          options={{
            title: tr('tab.chats'),
            tabBarBadge: unread ? (unread > 99 ? '99+' : unread) : undefined,
            tabBarIcon: ({ focused, size }) => (
              <ProductIcon name='chat' size={size} color={focused ? colors.badge : colors.date} />
            ),
          }}
        />
        <Tabs.Screen
          name='calls'
          options={{
            title: tr('tab.calls'),
            tabBarIcon: ({ focused, size }) => (
              <ProductIcon name='phone' size={size} color={focused ? colors.badge : colors.date} />
            ),
          }}
        />
        <Tabs.Screen
          name='contacts'
          options={{
            title: tr('tab.contacts'),
            tabBarBadge: pending ? (pending > 99 ? '99+' : pending) : undefined,
            tabBarIcon: ({ focused, size }) => (
              <ProductIcon name='users' size={size} color={focused ? colors.badge : colors.date} />
            ),
          }}
        />
        <Tabs.Screen
          name='groups'
          options={{
            href: null,
            title: tr('tab.groups'),
            tabBarIcon: ({ focused, size }) => (
              <ProductIcon name='users' size={size} color={focused ? colors.badge : colors.date} />
            ),
          }}
        />
        <Tabs.Screen
          name='me'
          options={{
            title: tr('tab.me'),
            tabBarIcon: ({ focused, size }) => (
              <ProductIcon name='user' size={size} color={focused ? colors.badge : colors.date} />
            ),
          }}
        />
        <Tabs.Screen name='index' options={{ href: null }} />
      </Tabs>
    </ProductShell>
  )
}
