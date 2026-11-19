import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Image, Linking, Pressable, View } from 'react-native'
import { Href, useRouter } from 'expo-router'
import { useOpenIM } from '../application/store'
import LoginScreen from '../auth/LoginScreen'
import { HeaderAction, ProductHint } from '../groups/group-ui'
import type { MessageKey } from '../i18n'
import { useT } from '../i18n'
import { ProductError } from '../shared/product-error'
import { useTask } from '../shared/useTask'
import { ProductSegment, ProductSheet } from '../ui/primitives'
import { ProductIcon } from '../ui/ProductIcon'
import { ProductListRow } from '../ui/ProductListRow'
import { ProductEmpty, ProductPage } from '../ui/ProductPage'
import { useProductTheme } from '../ui/theme'
import { safeExternalHttpURL, type ConversationAsset, type ConversationAssetKind } from './assets'
import { createConversationAssetsPager } from './assets-service'
import { ProductImagePreview } from './ProductImagePreview'

const tabs: { id: ConversationAssetKind, labelKey: MessageKey, emptyKey: MessageKey }[] = [
  { id: 'image', labelKey: 'assets.tabImages', emptyKey: 'assets.images' },
  { id: 'file', labelKey: 'assets.tabFiles', emptyKey: 'assets.files' },
  { id: 'link', labelKey: 'assets.tabLinks', emptyKey: 'assets.links' },
]

export default function ConversationAssetsScreen ({ id }: { id: string }) {
  const state = useOpenIM()
  if (!state.session)
    return <LoginScreen />
  return <Assets key={`${state.session.userID}:${state.session.imToken}:${id}`} id={id} />
}

function Assets ({ id }: { id: string }) {
  const tr = useT()
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
      title={tr('chatInfo.media')}
      white
      {...task}
      backHref='/chats'
      headerContent={
        <ProductSegment
          options={tabs.map(item => ({ value: item.id, label: tr(item.labelKey) }))}
          value={tab}
          onChange={value => setTab(value as ConversationAssetKind)}
        />
      }
    >
      {!conversation ? (
        <ProductHint>{tr('assets.chatMissing')}</ProductHint>
      ) : (
        <>
          {visible.length === 0 && !task.busy && !task.error && !hasMore && (
            <ProductEmpty title={tr('assets.empty', { kind: tr(tabs.find(item => item.id === tab)?.emptyKey ?? 'assets.images') })} />
          )}
          {tab === 'image' ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 2, padding: 2 }}>
              {visible.map(asset => (
                <Pressable
                  key={asset.id}
                  accessibilityRole='button'
                  accessibilityLabel={tr('assets.imageActions')}
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
                title={asset.title || tr(asset.kind === 'file' ? 'file.defaultName' : 'assets.image')}
                subtitle={`${asset.size ? `${Math.ceil(asset.size / 1024)} KB · ` : ''}${asset.senderName ? `${asset.senderName} · ` : ''}${asset.sendTime ? new Date(asset.sendTime).toLocaleDateString(tr.locale) : ''}`}
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
            <HeaderAction title={tr('assets.retry')} disabled={task.busy || !hasMore} onPress={loadNext} />
          )}
          {hasMore && !task.error && (
            <HeaderAction
              title={task.busy ? tr('assets.loading') : tr('assets.loadEarlier')}
              disabled={task.busy}
              onPress={loadNext}
            />
          )}
          {!hasMore && items.length > 0 && <ProductHint>{tr('assets.allLoaded')}</ProductHint>}
        </>
      )}
      {selected && (
        <ProductSheet
          error={task.error}
          busy={task.busy}
          onClose={() => setSelected(undefined)}
          items={[
            {
              title:
                selected.kind === 'image'
                  ? tr('assets.previewImage')
                  : selected.kind === 'file'
                    ? tr('assets.openFile')
                    : tr('assets.openLink'),
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
                    throw new ProductError('assets.linkUnavailable')
                  await Linking.openURL(url)
                  if (current())
                    setSelected(undefined)
                })
              },
            },
            {
              title: tr('assets.viewMessage'),
              onPress: () => {
                if (!task.busy) {
                  jumpToMessage(selected.messageID)
                  setSelected(undefined)
                }
              },
            },
          ]}
        >
        </ProductSheet>
      )}
      {preview && <ProductImagePreview uri={preview} onClose={() => setPreview(undefined)} />}
    </ProductPage>
  )
}
