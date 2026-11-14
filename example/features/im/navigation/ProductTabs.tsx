import React from 'react'
import { useWindowDimensions } from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { Tabs, useSegments } from 'expo-router'
import { useChatListColors } from '@/components/chat-list/theme'
import { useOpenIM } from '../application/store'

export default function ProductTabs () {
  const segments = useSegments()
  const { width } = useWindowDimensions()
  const colors = useChatListColors()
  const { session, conversations } = useOpenIM()
  const unread = conversations.reduce((total, conversation) => total + (conversation.unreadCount || 0), 0)
  if (!session && segments[1] !== 'explore')
    return null
  return (
    <Tabs backBehavior='initialRoute' screenOptions={{
      headerShown: false,
      tabBarPosition: width >= 900 ? 'left' : 'bottom',
      tabBarActiveTintColor: colors.badge,
      tabBarInactiveTintColor: colors.message,
      tabBarStyle: { backgroundColor: colors.headerBackground, borderColor: colors.divider },
      tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
      sceneStyle: { backgroundColor: colors.background },
    }}
    >
      <Tabs.Screen name='chats' options={{ title: '消息', tabBarBadge: unread ? (unread > 99 ? '99+' : unread) : undefined, tabBarIcon: ({ focused, size }) => <MaterialCommunityIcons name='message-outline' size={size} color={focused ? colors.badge : colors.message} /> }} />
      <Tabs.Screen name='contacts' options={{ title: '通讯录', tabBarIcon: ({ focused, size }) => <MaterialCommunityIcons name='account-multiple-outline' size={size} color={focused ? colors.badge : colors.message} /> }} />
      <Tabs.Screen name='groups' options={{ title: '群组', tabBarIcon: ({ focused, size }) => <MaterialCommunityIcons name='account-group-outline' size={size} color={focused ? colors.badge : colors.message} /> }} />
      <Tabs.Screen name='me' options={{ title: '我的', tabBarIcon: ({ focused, size }) => <MaterialCommunityIcons name='account-circle-outline' size={size} color={focused ? colors.badge : colors.message} /> }} />
      <Tabs.Screen name='index' options={{ href: null }} />
      <Tabs.Screen name='explore' options={{ href: null }} />
    </Tabs>
  )
}
