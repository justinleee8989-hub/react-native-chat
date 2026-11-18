import React, { useCallback, useEffect, useState } from 'react'
import { Text, View } from 'react-native'
import { Href, useLocalSearchParams, useRouter } from 'expo-router'
import { profile } from '../application/profile'
import { chooseAvatar } from '../application/profile-avatar'
import { useOpenIM } from '../application/store'
import LoginScreen from '../auth/LoginScreen'
import type { Person } from '../domain/directory'
import type { SelfProfile } from '../domain/profile'
import { HeaderAction, SettingField, ProductHint } from '../groups/group-ui'
import { showProductToast } from '../shared/ProductToast'
import { useTask } from '../shared/useTask'
import {
  ProductAvatar,
  ProductButton,
  ProductCard,
  ProductRow,
  ProductSheet,
  ProductSwitch,
} from '../ui/primitives'
import { ProductPage, ProductEmpty, ProductInset, ProductSection } from '../ui/ProductPage'
import { ProductSkeleton } from '../ui/ProductSkeleton'
import { useProductTheme } from '../ui/theme'
import PasswordForm from './PasswordForm'
import { profileEmail } from './profile-email'

export default function SettingsScreen () {
  const { session, config } = useOpenIM()
  return session ? <Settings key={`${session.userID}:${session.imToken}`} session={session} chatURL={config.chat} /> : <LoginScreen />
}
function Settings ({ session, chatURL }: { session: NonNullable<ReturnType<typeof useOpenIM>['session']>, chatURL: string }) {
  const router = useRouter()
  const t = useProductTheme()
  const [avatarMenu, setAvatarMenu] = useState(false)
  const { section } = useLocalSearchParams<{ section?: string }>()
  const show = (name: string) => !section || section === name
  const titles: Record<string, string> = {
    profile: '个人资料',
    privacy: '隐私与黑名单',
    notifications: '消息通知',
    security: '账户安全',
  }
  const task = useTask()
  const { run } = task
  const [self, setSelf] = useState<SelfProfile>()
  const [nickname, setNickname] = useState('')
  const [faceURL, setFaceURL] = useState('')
  const [blocked, setBlocked] = useState<Person[]>([])
  const setNotice = showProductToast
  const refresh = useCallback(
    () =>
      run(async current => {
        const [user, list] = await Promise.all([profile.self({ session, baseURL: chatURL }), profile.blacklist()])
        if (current()) {
          setSelf(user)
          setNickname(user.nickname || '')
          setFaceURL(user.faceURL || '')
          setBlocked(list)
        }
      }),
    [run, session, chatURL]
  )
  useEffect(() => {
    void refresh()
  }, [refresh])
  const pickAvatar = (source: 'library' | 'camera') => {
    setAvatarMenu(false)
    void run(async current => {
      const url = await chooseAvatar(current, source)
      if (!url || !current() || !self)
        return
      await profile.updateSelf(self.nickname || self.userID, url)
      if (current()) {
        setFaceURL(url)
        setSelf(user => user && { ...user, faceURL: url })
        setNotice('头像已上传并保存')
      }
    })
  }
  const save = () => {
    void run(async current => {
      await profile.updateSelf(nickname, faceURL)
      if (current()) {
        setSelf(user => user && { ...user, nickname: nickname.trim(), faceURL: faceURL.trim() })
        setNotice('资料已保存')
        if (router.canGoBack())
          router.back()
        else
          router.replace('/(tabs)/me')
      }
    })
  }
  return (
    <ProductPage
      backHref='/(tabs)/me'
      title={titles[section || ''] || '我的资料与设置'}
      {...task}
      // The sections are there from the first frame; only the values and the blacklist wait.
      loading={!task.hasSucceeded}
      onRetry={() => {
        void refresh()
      }}
      right={
        show('profile') ? (
          <HeaderAction
            title='保存'
            disabled={
              task.busy ||
              !self ||
              !nickname.trim() ||
              (nickname.trim() === self.nickname && faceURL.trim() === (self.faceURL || ''))
            }
            onPress={save}
          />
        ) : undefined
      }
    >
      {avatarMenu && (
        <ProductSheet
          onClose={() => setAvatarMenu(false)}
          items={[
            { title: '从相册选择', onPress: () => pickAvatar('library') },
            { title: '拍照', onPress: () => pickAvatar('camera') },
          ]}
        />
      )}
      {show('profile') && (
        <>
          <View style={{ alignItems: 'center', paddingTop: 20, paddingBottom: 20 }}>
            {self ? (
              <ProductAvatar
                id={self.userID}
                title={self.nickname || self.userID}
                uri={self.faceURL}
                size={96}
              />
            ) : (
              <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: t.surface2 }} />
            )}
            <View style={{ marginTop: 8 }}>
              <HeaderAction
                title='更换头像'
                disabled={task.busy || !self}
                onPress={() => setAvatarMenu(true)}
              />
            </View>
          </View>
          <ProductInset>
            <ProductCard>
              <SettingField
                editable={!task.busy}
                label='昵称'
                value={nickname}
                onChangeText={setNickname}
                placeholder='朋友们如何称呼你'
              />
              <ProductRow
                title='用户 ID'
                trailing={
                  <Text
                    selectable
                    numberOfLines={1}
                    style={{ color: t.text2, fontSize: 15, maxWidth: '58%' }}
                  >
                    {self?.userID}
                  </Text>
                }
              />
              <ProductRow
                title='邮箱'
                trailing={
                  <Text selectable style={{ color: t.text2, fontSize: 15, maxWidth: '58%' }}>
                    {profileEmail(self)}
                  </Text>
                }
              />
            </ProductCard>
          </ProductInset>
          <ProductHint>用户 ID 和邮箱不可修改。</ProductHint>
        </>
      )}
      {show('privacy') && (
        <>
          <ProductSection>黑名单{task.hasSucceeded ? ` · ${blocked.length}` : ''}</ProductSection>
          <ProductInset>
            <ProductCard>
              {!task.hasSucceeded && !task.error && <ProductSkeleton kind='list' rows={2} small />}
              {task.hasSucceeded && !blocked.length && !task.busy && <ProductEmpty title='暂无黑名单用户' />}
              {blocked.map(person => (
                <ProductRow
                  trailingInteractive
                  chevron={false}
                  key={person.userID}
                  title={person.nickname || person.userID}
                  subtitle={`ID：${person.userID}`}
                  leading={
                    <ProductAvatar
                      id={person.userID}
                      title={person.nickname || person.userID}
                      uri={person.faceURL}
                      size={40}
                    />
                  }
                  onPress={() =>
                    router.push(`/chats/people/${encodeURIComponent(person.userID)}` as Href)
                  }
                  trailing={
                    <ProductButton
                      compact
                      variant='gray'
                      title='移出'
                      disabled={task.busy}
                      onPress={() => {
                        void run(async current => {
                          await profile.block(person.userID, false)
                          if (current()) {
                            setBlocked(items =>
                              items.filter(item => item.userID !== person.userID)
                            )
                            setNotice('已移出黑名单')
                          }
                        })
                      }}
                    />
                  }
                />
              ))}
            </ProductCard>
          </ProductInset>
          <ProductHint>
            加入黑名单后，将无法正常接收对方的消息。可在联系人资料的「更多」中添加。
          </ProductHint>
        </>
      )}
      {show('notifications') && (
        <>
          <View style={{ height: 12 }} />
          <ProductInset>
            <ProductCard>
              <ProductRow
                title='全局免打扰'
                trailing={
                  <ProductSwitch
                    accessibilityLabel='全局免打扰'
                    value={self?.globalRecvMsgOpt === 2}
                    disabled={task.busy || !self}
                    onValueChange={muted => {
                      void run(async current => {
                        await profile.muteNotifications(muted)
                        if (current()) {
                          setSelf(user => user && { ...user, globalRecvMsgOpt: muted ? 2 : 0 })
                          setNotice(muted ? '已开启全局免打扰' : '已关闭全局免打扰')
                        }
                      })
                    }}
                  />
                }
              />
            </ProductCard>
          </ProductInset>
          <ProductHint>
            {self?.globalRecvMsgOpt === 2
              ? '已开启：所有会话都不再提醒，消息仍会正常接收。'
              : self?.globalRecvMsgOpt === 1
                ? '当前为不接收消息。'
                : '正常接收消息通知。'}
            此开关不修改系统通知权限。
          </ProductHint>
        </>
      )}
      {show('security') && <PasswordForm />}
    </ProductPage>
  )
}
