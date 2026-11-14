import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Image, Linking, Modal, Pressable, Text, View } from 'react-native'
import { Href, useRouter } from 'expo-router'
import { useChatListColors } from '@/components/chat-list/theme'
import { useOpenIM } from '../application/store'
import LoginScreen from '../auth/LoginScreen'
import { Action, Label, Page, styles } from '../shared/shared'
import { useTask } from '../shared/useTask'
import { safeExternalHttpURL, type ConversationAsset, type ConversationAssetKind } from './assets'
import { createConversationAssetsPager } from './assets-service'

const tabs: { id: ConversationAssetKind, label: string }[] = [
  { id: 'image', label: '图片' },
  { id: 'file', label: '文件' },
  { id: 'link', label: '链接' },
]

export default function ConversationAssetsScreen ({ id }: { id: string }) {
  const state = useOpenIM()
  if (!state.session)
    return <LoginScreen />
  return <Assets key={`${state.session.userID}:${state.session.imToken}:${id}`} id={id} />
}

function Assets ({ id }: { id: string }) {
  const state = useOpenIM()
  const conversation = state.conversations.find(item => item.conversationID === id)
  const colors = useChatListColors()
  const router = useRouter()
  const task = useTask()
  const { run } = task
  const alive = useRef(false)
  const loading = useRef(false)
  const [items, setItems] = useState<ConversationAsset[]>([])
  const [tab, setTab] = useState<ConversationAssetKind>('image')
  const [hasMore, setHasMore] = useState(true)
  const [preview, setPreview] = useState<string>()
  const pager = useMemo(() => state.session
    ? createConversationAssetsPager(state.session, state.config.chat, () => alive.current)
    : undefined, [state.session, state.config.chat])

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  const loadNext = useCallback(() => {
    if (!conversation || !pager || loading.current)
      return
    loading.current = true
    void run(async current => {
      const result = await pager.loadNext(id)
      if (current() && alive.current) {
        setItems(previous => {
          const byID = new Map(previous.map(item => [item.id, item]))
          result.assets.forEach(item => byID.set(item.id, item))
          return [...byID.values()].sort((left, right) => right.sendTime - left.sendTime)
        })
        setHasMore(!result.done)
      }
    }).finally(() => {
      loading.current = false
    })
  }, [conversation, pager, run, id])

  useEffect(() => {
    if (conversation)
      loadNext()
  }, [conversation, loadNext])

  const visible = items.filter(item => item.kind === tab)
  const jumpToMessage = (messageID: string) => {
    router.push({ pathname: '/chats/[id]', params: { id, messageID } } as Href)
  }

  return (
    <Page title={`${conversation?.showName || '会话'} · 图片、文件与链接`} {...task}>
      {!conversation ? (
        <Label>找不到此会话。请先从会话列表打开聊天，再进入汇总页。</Label>
      ) : (
        <>
          <Label>内容来自服务端允许当前账号访问的历史记录，可继续加载更早内容。</Label>
          <View style={styles.actions}>
            {tabs.map(item => (
              <Pressable
                key={item.id}
                accessibilityRole='tab'
                accessibilityState={{ selected: tab === item.id }}
                onPress={() => setTab(item.id)}
                style={{ paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, backgroundColor: tab === item.id ? colors.selectedRow : colors.pressed }}
              >
                <Text style={{ color: tab === item.id ? colors.attachment : colors.name, fontWeight: '600' }}>
                  {item.label} · {items.filter(asset => asset.kind === item.id).length}
                </Text>
              </Pressable>
            ))}
          </View>
          {visible.length === 0 && !task.busy && !task.error && !hasMore && (
            <Label>已检查服务端可访问的聊天记录，没有更多{tabs.find(item => item.id === tab)?.label}。</Label>
          )}
          {visible.map(asset => (
            <AssetRow
              key={asset.id}
              asset={asset}
              busy={task.busy}
              colors={colors}
              onPreview={() => setPreview(asset.uri)}
              onOpen={() => {
                const url = safeExternalHttpURL(asset.uri)
                if (!url)
                  return
                void run(async () => {
                  await Linking.openURL(url)
                })
              }}
              onJump={() => jumpToMessage(asset.messageID)}
            />
          ))}
          {!!task.error && (
            <Action title='重试加载' disabled={task.busy || !hasMore} onPress={loadNext} />
          )}
          {hasMore && !task.error && (
            <Action title={task.busy ? '正在加载…' : items.length ? '加载更早内容' : '加载服务端内容'} disabled={task.busy} onPress={loadNext} />
          )}
          {!hasMore && items.length > 0 && <Label>已加载到服务端可访问历史的末尾。</Label>}
        </>
      )}
      <Modal visible={!!preview} transparent animationType='fade' onRequestClose={() => setPreview(undefined)}>
        <Pressable onPress={() => setPreview(undefined)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' }} accessibilityRole='button' accessibilityLabel='关闭图片预览'>
          {!!preview && <Image source={{ uri: preview }} resizeMode='contain' style={{ width: '100%', height: '85%' }} />}
        </Pressable>
      </Modal>
    </Page>
  )
}

function AssetRow ({ asset, busy, colors, onPreview, onOpen, onJump }: {
  asset: ConversationAsset
  busy: boolean
  colors: ReturnType<typeof useChatListColors>
  onPreview: () => void
  onOpen: () => void
  onJump: () => void
}) {
  const date = asset.sendTime ? new Date(asset.sendTime).toLocaleString('zh-CN') : ''
  return (
    <View style={{ gap: 8, padding: 12, borderBottomWidth: 1, borderColor: colors.divider }}>
      {asset.kind === 'image' && asset.uri ? (
        <Pressable onPress={onPreview} accessibilityRole='button' accessibilityLabel='预览图片' style={{ width: 112, height: 112, borderRadius: 8, overflow: 'hidden', backgroundColor: colors.pressed }}>
          <Image source={{ uri: asset.uri }} resizeMode='cover' style={{ width: '100%', height: '100%' }} />
        </Pressable>
      ) : (
        <Text numberOfLines={2} style={{ color: colors.name, fontWeight: '600' }}>{asset.title}</Text>
      )}
      {!!date && <Text style={{ color: colors.message }}>{date}</Text>}
      <View style={styles.actions}>
        {asset.kind === 'file' && (
          <Action title={asset.uri ? '打开文件' : '文件链接不可用'} disabled={busy || !asset.uri} onPress={onOpen} />
        )}
        {asset.kind === 'link' && <Action title='打开链接' disabled={busy || !safeExternalHttpURL(asset.uri)} onPress={onOpen} />}
        <Action title='查看原消息' disabled={busy} onPress={onJump} />
      </View>
    </View>
  )
}
