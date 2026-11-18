import React, { useCallback, useRef, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { ChatList, type ChatListItem } from '@kesha-antonov/react-native-chat'
import { type Href, useFocusEffect, usePathname, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { offlineStatus } from '../application/connection-status'
import {
  refresh,
  prefetchConversationHistory,
  reportError,
  useOpenIM,
  setPinned,
  setMuted,
  removeConversations,
  setArchived,
} from '../application/store'
import { parseCallInvitation } from '../calls/invitation'
import { toChat } from '../domain/model'
import { useDesktopNavigation, useMasterNavigation } from '../navigation/DesktopNavigation'
import { traceChatEntry } from '../navigation/entry-performance'
import { useStartupReadiness } from '../navigation/StartupReadiness'
import { useChatEntry } from '../navigation/useChatEntry'
import { ConnectionStatus } from '../shared/ConnectionStatus'
import { Confirm } from '../shared/shared'
import { useTask } from '../shared/useTask'
import { useProductLayout, useProductScheme } from '../ui/preferences'
import { ProductHeader, ProductSearch, ProductSheet } from '../ui/primitives'
import { useProductChatTheme } from '../ui/ProductChatTheme'
import { ProductIcon } from '../ui/ProductIcon'
import { ProductEmpty } from '../ui/ProductPage'
import { ProductIconButton } from '../ui/ProductPage'
import { useProductTheme } from '../ui/theme'
import { isChatRouteActive } from './chat-route'
import { ProductArchiveRow } from './ProductArchiveRow'
import { ProductChatRow } from './ProductChatRow'

export default function ChatListScreen ({
  archived = false,
  autoRefresh = true,
}: {
  archived?: boolean
  autoRefresh?: boolean
}) {
  const { session } = useOpenIM()
  return session ? (
    <SessionChatList
      key={`${session.userID}:${session.imToken}`}
      archived={archived}
      autoRefresh={autoRefresh}
    />
  ) : null
}
function SessionChatList ({ archived, autoRefresh }: { archived: boolean, autoRefresh: boolean }) {
  const router = useRouter()
  const openMaster = useMasterNavigation()
  const navigation = useDesktopNavigation()
  const open = archived ? (href: Href) => router.push(href) : openMaster
  const pathname = usePathname()
  const task = useTask()
  const state = useOpenIM()
  const chatEntry = useChatEntry(
    `${state.session?.userID}:${state.session?.imToken}`,
    open,
    id => !!state.messages[id]?.length,
    state.conversations.find(item => state.messages[item.conversationID]?.length)?.conversationID
  )
  const t = useProductTheme()
  const theme = useProductChatTheme()
  const scheme = useProductScheme()
  const { desktop } = useProductLayout()
  const { markReady } = useStartupReadiness()
  const [pullRefreshing, setPullRefreshing] = useState(false)
  const [query, setQuery] = useState('')
  const [menu, setMenu] = useState<ChatListItem>()
  const [creating, setCreating] = useState(false)
  const [selected, setSelected] = useState<string[] | null>(null)
  const [deleting, setDeleting] = useState<string[]>([])
  const refreshing = useRef(false)
  useFocusEffect(
    useCallback(() => {
      if (!state.session || !autoRefresh)
        return
      let focused = true
      const sync = async () => {
        if (!focused || refreshing.current || state.busy)
          return
        refreshing.current = true
        try {
          await refresh()
        } catch (error) {
          reportError(error)
        } finally {
          refreshing.current = false
        }
      }
      void sync()
      const timer = setInterval(() => {
        void sync()
      }, 5000)
      return () => {
        focused = false
        clearInterval(timer)
      }
    }, [state.session, state.busy, autoRefresh])
  )
  if (!state.session)
    return null
  const chats = state.conversations.map(conversation => {
    const chat = toChat(conversation, state.session?.userID)
    if (chat.lastMessage && parseCallInvitation(chat.lastMessage.text))
      chat.lastMessage = { ...chat.lastMessage, text: '音视频通话邀请' }
    return chat
  })
  const shown = chats.filter(
    chat =>
      !!chat.isArchived === archived &&
      `${chat.title} ${chat.lastMessage?.text || ''} ${(state.messages[String(chat.id)] || []).map(message => message.projection?.text ?? message.textElem?.content ?? message.atTextElem?.text ?? message.quoteElem?.text ?? '').join(' ')}`
        .toLowerCase()
        .includes(query.trim().toLowerCase())
  )
  // Offline with nothing cached: say so instead of a skeleton that would never resolve.
  const offlineEmpty = !state.conversationsLoaded && !!state.offline
  const initialLoading = !state.conversationsLoaded && !chats.length && !state.error && !state.offline
  const homeLaidOut = () => {
    if (!archived && !initialLoading && state.session)
      markReady(state.session)
  }
  const archivedChats = chats.filter(chat => chat.isArchived)
  const picked = chats.filter(chat => selected?.includes(String(chat.id)))
  const run = (action: () => Promise<unknown>) => {
    void task.run(async current => {
      await action()
      if (current()) {
        setMenu(undefined)
        setSelected(null)
      }
    })
  }
  const toggle = (id: string) =>
    setSelected(items =>
      items?.includes(id) ? items.filter(item => item !== id) : [...(items || []), id]
    )
  const actionItems = (items: ChatListItem[]) => {
    const ids = items.map(item => String(item.id))
    const pinned = items.length > 0 && items.every(item => item.isPinned)
    const muted = items.length > 0 && items.every(item => item.isMuted)
    return [
      {
        icon: 'pin' as const,
        title: pinned ? '取消置顶' : '置顶',
        press: () => run(() => setPinned(ids, !pinned)),
      },
      {
        icon: 'bellOff' as const,
        title: muted ? '关闭免打扰' : '免打扰',
        press: () => run(() => setMuted(ids, !muted)),
      },
      {
        icon: 'archive' as const,
        title: archived ? '取消归档' : '归档',
        press: () => run(() => setArchived(ids, !archived)),
      },
      {
        icon: 'trash' as const,
        title: '删除会话',
        press: () => {
          setMenu(undefined)
          setDeleting(ids)
        },
      },
    ]
  }
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.page }}>
      <View
        style={{
          flex: 1,
          width: '100%',
          alignSelf: 'center',
          maxWidth: desktop && archived ? 680 : undefined,
        }}
      >
        {selected ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              height: 52,
              paddingHorizontal: 16,
            }}
          >
            <Pressable onPress={() => setSelected(null)}>
              <Text style={{ color: t.accent }}>取消</Text>
            </Pressable>
            <Text style={{ color: t.text }}>已选择 {picked.length} 项</Text>
            <Pressable
              onPress={() =>
                setSelected(
                  picked.length === shown.length ? [] : shown.map(chat => String(chat.id))
                )
              }
            >
              <Text style={{ color: t.accent }}>
                {picked.length === shown.length ? '全不选' : '全选'}
              </Text>
            </Pressable>
          </View>
        ) : (
          <ProductHeader
            detail={archived}
            title={archived ? '已归档会话' : '消息'}
            large={!archived}
            backgroundColor={t.page}
            onBack={
              archived && navigation?.canGoBackInSection !== false
                ? () => router.replace('/(tabs)/chats')
                : undefined
            }
            right={
              !archived && (
                <ProductIconButton name='compose' label='新建' onPress={() => setCreating(true)} />
              )
            }
          />
        )}
        {!selected && !archived && (
          <ProductSearch side placeholder='搜索' value={query} onChangeText={setQuery} />
        )}
        {!!query.trim() && (
          <Text style={{ color: t.text3, fontSize: 12, paddingHorizontal: 20, paddingBottom: 8 }}>
            搜索会话名称和已加载消息；完整可访问历史请进入聊天信息搜索。
          </Text>
        )}
        <ConnectionStatus status={state.status} />
        {!archived && !query.trim() && !selected && archivedChats.length > 0 && (
          <ProductArchiveRow
            active={pathname === '/chats/archived'}
            chats={archivedChats}
            onPress={() => open('/chats/archived')}
          />
        )}
        <ChatList
          chats={shown}
          colorScheme={scheme}
          theme={theme}
          darkTheme={theme}
          user={{ _id: state.session.userID }}
          locale='zh-CN'
          labels={{ chatListArchived: '已归档会话' }}
          isHeaderVisible={false}
          isArchiveOpen={archived}
          isLoading={initialLoading}
          onArchiveOpenChange={expanded =>
            open((expanded ? '/chats/archived' : '/(tabs)/chats') as Href)
          }
          onArchiveChats={(items, value) =>
            run(() =>
              setArchived(
                items.map(item => String(item.id)),
                value
              )
            )
          }
          renderChat={({ chat, onSwipe }) => (
            <ProductChatRow
              last={shown.at(-1)?.id === chat.id}
              archived={archived}
              user={{ _id: state.session!.userID }}
              onSwipe={onSwipe ? () => onSwipe(chat) : undefined}
              chat={chat}
              selecting={!!selected}
              selected={!!selected?.includes(String(chat.id))}
              active={isChatRouteActive(pathname, String(chat.id))}
              onPressIn={() => {
                if (!selected) {
                  traceChatEntry(`${state.session?.userID}:${state.session?.imToken}`, String(chat.id), 'press-in')
                  if (!state.messages[String(chat.id)]?.length)
                    void prefetchConversationHistory(String(chat.id))
                  chatEntry.prepare(String(chat.id))
                }
              }}
              onPress={() => {
                if (selected) {
                  toggle(String(chat.id))
                  return
                }
                chatEntry.open(String(chat.id))
              }}
              onMenu={() => (selected ? toggle(String(chat.id)) : setMenu(chat))}
            />
          )}
          renderEmpty={() => <View onLayout={homeLaidOut}>{!state.conversationsLoaded && !!state.error ? (
            <View style={{ padding: 24, alignItems: 'center' }}>
              <Text style={{ color: t.text2 }}>会话加载失败，请重试</Text>
              <Pressable accessibilityRole='button' accessibilityLabel='重新加载会话' disabled={state.busy} onPress={() => {
                void refresh().catch(reportError)
              }} style={{ padding: 16 }}
              >
                <Text style={{ color: t.accent }}>重新加载</Text>
              </Pressable>
            </View>
          ) : offlineEmpty && !query ? (
            <ProductEmpty title={offlineStatus} subtitle='网络恢复后会自动重新连接' />
          ) : (
            <ProductEmpty
              title={query ? '没有找到相关会话' : archived ? '没有已归档的会话' : '还没有会话'}
              subtitle={query ? undefined : archived ? '长按会话可以归档' : '点右上角开始聊天'}
            />
          )}</View>}
          listProps={{
            onContentSizeChange: (_width, height) => {
              if (height > 0)
                homeLaidOut()
            },
            refreshing: pullRefreshing,
            onRefresh: () => {
              setPullRefreshing(true)
              void refresh().catch(reportError).finally(() => setPullRefreshing(false))
            },
          }}
        />
        {selected && (
          <View
            style={{
              flexDirection: 'row',
              paddingVertical: 12,
              borderTopWidth: 0.5,
              borderColor: t.line,
            }}
          >
            {actionItems(picked).map(action => (
              <Pressable
                key={action.icon}
                accessibilityRole='button'
                disabled={!picked.length || task.busy}
                onPress={action.press}
                style={{ flex: 1, alignItems: 'center', gap: 5, opacity: picked.length ? 1 : 0.4 }}
              >
                <ProductIcon
                  name={action.icon}
                  color={action.icon === 'trash' ? t.danger : t.text2}
                />
                <Text style={{ color: action.icon === 'trash' ? t.danger : t.text2, fontSize: 12 }}>
                  {action.title}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
        {menu && (
          <ProductSheet
            busy={task.busy}
            title={menu.title}
            onClose={() => setMenu(undefined)}
            items={[
              ...actionItems([menu])
                .slice(0, 3)
                .map(action => ({ title: action.title, onPress: action.press })),
              ...(archived
                ? []
                : [
                  {
                    title: '多选',
                    onPress: () => {
                      setSelected([String(menu.id)])
                      setMenu(undefined)
                    },
                  },
                ]),
              { title: '删除会话', danger: true, onPress: actionItems([menu])[3].press },
            ]}
          />
        )}
        {creating && (
          <ProductSheet
            onClose={() => setCreating(false)}
            items={[
              ['发起聊天', '/chats/new'],
              ['创建群聊', '/chats/groups/create'],
              ['添加好友', '/chats/add-friend'],
              ['通过群 ID 加群', '/chats/groups/join'],
            ].map(([title, href]) => ({
              title,
              onPress: () => {
                setCreating(false)
                open(href as Href)
              },
            }))}
          />
        )}
        {!!(task.error || state.error) && (
          <Text accessibilityRole='alert' style={{ color: t.danger, padding: 12 }}>
            {task.error || state.error}
          </Text>
        )}
        {!!deleting.length && (
          <Confirm
            error={task.error}
            message={`删除 ${deleting.length} 个会话及其聊天记录？此操作无法撤销。`}
            busy={task.busy}
            onCancel={() => setDeleting([])}
            onConfirm={() =>
              run(async () => {
                await removeConversations(deleting)
                setDeleting([])
              })
            }
          />
        )}
      </View>
    </SafeAreaView>
  )
}
