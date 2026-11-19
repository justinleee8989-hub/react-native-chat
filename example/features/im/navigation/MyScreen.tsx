import React, { useCallback, useState } from 'react'
import { Text, View } from 'react-native'
import { Href, useFocusEffect, useRouter } from 'expo-router'
import { profile } from '../application/profile'
import { logout, useOpenIM } from '../application/store'
import type { SelfProfile } from '../domain/profile'
import { rememberedValue } from '../shared/remembered'
import { Confirm } from '../shared/shared'
import { useTask } from '../shared/useTask'
import { useProductLayout } from '../ui/preferences'
import { ProductAvatar, ProductCard, ProductRow } from '../ui/primitives'
import { ProductPage } from '../ui/ProductPage'
import { useProductTheme } from '../ui/theme'
import { useMasterNavigation } from './DesktopNavigation'

// Kept so that the page, mounted again on PC as navigation moves in and out of 我的, starts filled.
const remembered = rememberedValue<{ self: SelfProfile, blacklistCount: number }>()

export default function MyScreen () {
  const { session } = useOpenIM()
  return session ? (
    <MyAccount key={`${session.userID}:${session.imToken}`} account={`${session.userID}:${session.imToken}`} userID={session.userID} />
  ) : null
}
function MyAccount ({ userID, account }: { userID: string, account: string }) {
  const t = useProductTheme()
  const { desktop } = useProductLayout()
  const router = useRouter()
  const openMaster = useMasterNavigation()
  const { busy } = useOpenIM()
  const task = useTask()
  const { run } = task
  const [kept] = useState(() => remembered.get(account))
  const [blacklistCount, setBlacklistCount] = useState(kept?.blacklistCount ?? 0)
  const [self, setSelf] = useState<SelfProfile | undefined>(kept?.self)
  const [confirmLogout, setConfirmLogout] = useState(false)
  const refresh = useCallback(() => run(async current => {
    const [result, list] = await Promise.all([profile.self(), profile.blacklist()])
    if (current()) {
      setSelf(result)
      setBlacklistCount(list.length)
      remembered.set(account, { self: result, blacklistCount: list.length })
    }
  }), [run, account])
  useFocusEffect(useCallback(() => {
    void refresh()
  }, [refresh]))
  return (
    // A phone opens on the profile card; PC keeps the title, as every master list there has one.
    <ProductPage title='我的' root headerHidden={!desktop} {...task} loading={!task.hasSucceeded && !kept} onRetry={() => {
      void refresh()
    }}
    >
      <View style={{ marginHorizontal: desktop ? 12 : 16, marginTop: desktop ? 12 : 20, gap: 24 }}>
        <ProductCard>
          <ProductRow
            big
            title={self?.nickname || userID}
            subtitle={`ID：${userID}`}
            leading={
              <ProductAvatar
                id={userID}
                title={self?.nickname || userID}
                uri={self?.faceURL}
                size={64}
              />
            }
            onPress={() => openMaster('/chats/settings?section=profile' as Href)}
          />
        </ProductCard>
        <ProductCard>
          <ProductRow
            title='消息通知'
            trailing={
              self?.globalRecvMsgOpt === 2 ? (
                <Text style={{ color: t.text2, fontSize: 15 }}>全局免打扰</Text>
              ) : undefined
            }
            onPress={() => openMaster('/chats/settings?section=notifications' as Href)}
          />
          <ProductRow
            title='隐私与黑名单'
            trailing={
              blacklistCount ? (
                <Text style={{ color: t.text2, fontSize: 15 }}>{blacklistCount} 人</Text>
              ) : undefined
            }
            onPress={() => openMaster('/chats/settings?section=privacy' as Href)}
          />
          <ProductRow
            title='账户安全'
            onPress={() => openMaster('/chats/settings?section=security' as Href)}
          />
        </ProductCard>
        <ProductCard>
          <ProductRow
            title='外观'
            onPress={() => openMaster('/chats/appearance' as Href)}
          />
        </ProductCard>
        <ProductCard>
          <ProductRow
            title='退出登录'
            danger
            centered
            onPress={() => {
              if (!busy)
                setConfirmLogout(true)
            }}
          />
        </ProductCard>
      </View>
      {confirmLogout && (
        <Confirm
          title='退出当前账户？'
          message='你可以随时重新登录。'
          confirmLabel='退出'
          busy={busy}
          onCancel={() => setConfirmLogout(false)}
          onConfirm={() => {
            void logout().then(() => router.replace('/auth/login' as Href))
          }}
        />
      )}
    </ProductPage>
  )
}
