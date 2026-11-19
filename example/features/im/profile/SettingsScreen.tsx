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
import { useT } from '../i18n'
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
  const tr = useT()
  const router = useRouter()
  const t = useProductTheme()
  const [avatarMenu, setAvatarMenu] = useState(false)
  const { section } = useLocalSearchParams<{ section?: string }>()
  const show = (name: string) => !section || section === name
  const titles: Record<string, string> = {
    profile: tr('settings.profile'),
    privacy: tr('me.privacy'),
    notifications: tr('me.notifications'),
    security: tr('me.accountSecurity'),
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
        setNotice(tr('settings.avatarSaved'))
      }
    })
  }
  const save = () => {
    void run(async current => {
      await profile.updateSelf(nickname, faceURL)
      if (current()) {
        setSelf(user => user && { ...user, nickname: nickname.trim(), faceURL: faceURL.trim() })
        setNotice(tr('settings.saved'))
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
      title={titles[section || ''] || tr('settings.title')}
      {...task}
      // The sections are there from the first frame; only the values and the blacklist wait.
      loading={!task.hasSucceeded}
      onRetry={() => {
        void refresh()
      }}
      right={
        show('profile') ? (
          <HeaderAction
            title={tr('common.save')}
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
            { title: tr('wallpaper.choosePhoto'), onPress: () => pickAvatar('library') },
            { title: tr('settings.takePhoto'), onPress: () => pickAvatar('camera') },
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
                title={tr('settings.changeAvatar')}
                disabled={task.busy || !self}
                onPress={() => setAvatarMenu(true)}
              />
            </View>
          </View>
          <ProductInset>
            <ProductCard>
              <SettingField
                editable={!task.busy}
                label={tr('person.nickname')}
                value={nickname}
                onChangeText={setNickname}
                placeholder={tr('settings.nicknamePlaceholder')}
              />
              <ProductRow
                title={tr('person.userID')}
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
                title={tr('person.email')}
                trailing={
                  <Text selectable style={{ color: t.text2, fontSize: 15, maxWidth: '58%' }}>
                    {profileEmail(self)}
                  </Text>
                }
              />
            </ProductCard>
          </ProductInset>
          <ProductHint>{tr('settings.idEmailFixed')}</ProductHint>
        </>
      )}
      {show('privacy') && (
        <>
          <ProductSection>{tr('settings.blocklist', { count: task.hasSucceeded ? ` · ${blocked.length}` : '' })}</ProductSection>
          <ProductInset>
            <ProductCard>
              {!task.hasSucceeded && !task.error && <ProductSkeleton kind='list' rows={2} small />}
              {task.hasSucceeded && !blocked.length && !task.busy && <ProductEmpty title={tr('settings.noBlocked')} />}
              {blocked.map(person => (
                <ProductRow
                  trailingInteractive
                  chevron={false}
                  key={person.userID}
                  title={person.nickname || person.userID}
                  subtitle={tr('common.idLabel', { id: person.userID })}
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
                      title={tr('settings.unblock')}
                      disabled={task.busy}
                      onPress={() => {
                        void run(async current => {
                          await profile.block(person.userID, false)
                          if (current()) {
                            setBlocked(items =>
                              items.filter(item => item.userID !== person.userID)
                            )
                            setNotice(tr('person.unblocked'))
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
            {tr('settings.blockHint')}
          </ProductHint>
        </>
      )}
      {show('notifications') && (
        <>
          <View style={{ height: 12 }} />
          <ProductInset>
            <ProductCard>
              <ProductRow
                title={tr('me.doNotDisturb')}
                trailing={
                  <ProductSwitch
                    accessibilityLabel={tr('me.doNotDisturb')}
                    value={self?.globalRecvMsgOpt === 2}
                    disabled={task.busy || !self}
                    onValueChange={muted => {
                      void run(async current => {
                        await profile.muteNotifications(muted)
                        if (current()) {
                          setSelf(user => user && { ...user, globalRecvMsgOpt: muted ? 2 : 0 })
                          setNotice(muted ? tr('settings.dndOn') : tr('settings.dndOff'))
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
              ? tr('settings.dndOnHint')
              : self?.globalRecvMsgOpt === 1
                ? tr('settings.notReceivingHint')
                : tr('settings.receivingHint')}
          </ProductHint>
        </>
      )}
      {show('security') && <PasswordForm />}
    </ProductPage>
  )
}
