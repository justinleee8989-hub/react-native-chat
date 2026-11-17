import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Image, Linking, Pressable, Text, View } from 'react-native'
import { Href, useRouter } from 'expo-router'
import { useOpenIM } from '../application/store'
import LoginScreen from '../auth/LoginScreen'
import { HeaderAction, ProductHint } from '../groups/group-ui'
import { useTask } from '../shared/useTask'
import { ProductSegment, ProductSheet } from '../ui/primitives'
import { ProductIcon } from '../ui/ProductIcon'
import { ProductListRow } from '../ui/ProductListRow'
import { ProductEmpty, ProductPage } from '../ui/ProductPage'
import { useProductTheme } from '../ui/theme'
import { safeExternalHttpURL, type ConversationAsset, type ConversationAssetKind } from './assets'
import { createConversationAssetsPager } from './assets-service'
import { ProductImagePreview } from './ProductImagePreview'

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
  const t = useProductTheme()
  const router = useRouter()
  const task = useTask()
  const { run } = task
  const alive = useRef(false)
  const loading = useRef(false)
  const [items, setItems] = useState<ConversationAsset[]>([])
  const [tab, setTab] = useState<ConversationAssetKind>('image')
  const [hasMore, setHasMore] = useState(true)
  const [preview, setPreview] = useState<string>()
  const [selected, setSelected] = useState<ConversationAsset>()
  const pager = useMemo(
    () =>
      state.session
        ? createConversationAssetsPager(state.session, state.config.chat, () => alive.current)
        : undefined,
    [state.session, state.config.chat]
  )

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
    router.dismissTo({ pathname: '/chats/[id]', params: { id, messageID } } as Href)
  }

  return (
    <ProductPage
      title='图片、文件与链接'
      white
      {...task}
      backHref='/chats'
      headerContent={
        <ProductSegment
          options={tabs.map(item => ({ value: item.id, label: item.label }))}
          value={tab}
          onChange={value => setTab(value as ConversationAssetKind)}
        />
      }
    >
      {!conversation ? (
        <ProductHint>找不到此会话，请返回会话列表。</ProductHint>
      ) : (
        <>
          {visible.length === 0 && !task.busy && !task.error && !hasMore && (
            <ProductEmpty title={`暂无${tabs.find(item => item.id === tab)?.label}`} />
          )}
          {tab === 'image' ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 2, padding: 2 }}>
              {visible.map(asset => (
                <Pressable
                  key={asset.id}
                  accessibilityRole='button'
                  accessibilityLabel='图片操作'
                  onPress={() => setSelected(asset)}
                  style={{ width: '32.9%', aspectRatio: 1, backgroundColor: t.surface2 }}
                >
                  <Image
                    source={{ uri: asset.uri }}
                    resizeMode='cover'
                    style={{ width: '100%', height: '100%' }}
                  />
                </Pressable>
              ))}
            </View>
          ) : (
            visible.map((asset, index) => (
              <ProductListRow
                small
                titleWeight={tab === 'link' ? '500' : '600'}
                last={index === visible.length - 1}
                key={asset.id}
                title={asset.title}
                subtitle={`${asset.size ? `${Math.ceil(asset.size / 1024)} KB · ` : ''}${asset.senderName ? `${asset.senderName} · ` : ''}${asset.sendTime ? new Date(asset.sendTime).toLocaleDateString('zh-CN') : ''}`}
                leading={
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 14,
                      backgroundColor: t.surface2,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <ProductIcon name={tab === 'file' ? 'file' : 'search'} color={t.text2} />
                  </View>
                }
                onPress={() => setSelected(asset)}
              />
            ))
          )}
          {!!task.error && (
            <HeaderAction title='重试加载' disabled={task.busy || !hasMore} onPress={loadNext} />
          )}
          {hasMore && !task.error && (
            <HeaderAction
              title={task.busy ? '正在加载…' : '加载更早内容'}
              disabled={task.busy}
              onPress={loadNext}
            />
          )}
          {!hasMore && items.length > 0 && <ProductHint>已加载全部可访问记录</ProductHint>}
        </>
      )}
      {selected && (
        <ProductSheet
          busy={task.busy}
          onClose={() => setSelected(undefined)}
          items={[
            {
              title:
                selected.kind === 'image'
                  ? '预览图片'
                  : selected.kind === 'file'
                    ? '打开文件'
                    : '打开链接',
              onPress: () => {
                if (task.busy)
                  return
                if (selected.kind === 'image') {
                  setPreview(selected.uri)
                  setSelected(undefined)
                  return
                }
                const url = safeExternalHttpURL(selected.uri)
                void run(async current => {
                  if (!url)
                    throw new Error('链接不可用')
                  await Linking.openURL(url)
                  if (current())
                    setSelected(undefined)
                })
              },
            },
            {
              title: '查看原消息',
              onPress: () => {
                if (!task.busy) {
                  jumpToMessage(selected.messageID)
                  setSelected(undefined)
                }
              },
            },
          ]}
        >
          {!!task.error && (
            <Text accessibilityRole='alert' style={{ color: t.danger }}>
              {task.error}
            </Text>
          )}
        </ProductSheet>
      )}
      {preview && <ProductImagePreview uri={preview} onClose={() => setPreview(undefined)} />}
    </ProductPage>
  )
}
