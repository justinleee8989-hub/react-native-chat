import React, { useCallback, useEffect, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import * as Crypto from 'expo-crypto'
import { type Href, useLocalSearchParams, useRouter } from 'expo-router'
import { contactDirectoryEvents, directory } from '../application/directory'
import { profile } from '../application/profile'
import { calls, openConversation, useOpenIM } from '../application/store'
import LoginScreen from '../auth/LoginScreen'
import type { Person } from '../domain/directory'
import { profileEmail } from '../profile/profile-email'
import { ProductPromptField } from '../shared/ProductPromptField'
import { showProductToast } from '../shared/ProductToast'
import { Action, Confirm, Label } from '../shared/shared'
import { useDirectoryEvents } from '../shared/useDirectoryEvents'
import { useTask } from '../shared/useTask'
import {
  ProductAvatar,
  ProductButton,
  ProductCard,
  ProductRow,
  ProductSwitch,
} from '../ui/primitives'
import { ProductIcon } from '../ui/ProductIcon'
import { useProductTheme } from '../ui/theme'
import { ContactIconButton, ContactInset, ContactLayout, ContactSection } from './ContactLayout'

export default function PersonScreen ({ more = false }: { more?: boolean }) {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { session } = useOpenIM()
  return session ? (
    <PersonDetails
      key={`${session.userID}:${session.imToken}:${id}`}
      id={id}
      selfID={session.userID}
      more={more}
    />
  ) : (
    <LoginScreen />
  )
}
function PersonDetails ({ id, selfID, more }: { id: string, selfID: string, more: boolean }) {
  const router = useRouter()
  const t = useProductTheme()
  const task = useTask()
  const { run } = task
  const [person, setPerson] = useState<Person>()
  const [remark, setRemark] = useState('')
  const [editing, setEditing] = useState(false)
  const [blocked, setBlocked] = useState(false)
  const [confirm, setConfirm] = useState<'block' | 'delete'>()
  const [loaded, setLoaded] = useState(false)
  const setNotice = showProductToast
  const refresh = useCallback(
    () =>
      run(async current => {
        const [user, list] = await Promise.all([profile.person(id), profile.blacklist()])
        if (current()) {
          setPerson(user)
          setRemark(user?.remark || '')
          setBlocked(list.some(item => item.userID === id))
          setLoaded(true)
        }
      }),
    [id, run]
  )
  useDirectoryEvents(contactDirectoryEvents, refresh, task.busy)
  useEffect(() => {
    void refresh()
  }, [refresh])
  const self = id === selfID
  const name = person?.remark || person?.nickname || id
  const value = (text: string) => (
    <Text selectable style={{ color: t.text2, fontSize: 15, maxWidth: '58%' }}>
      {text}
    </Text>
  )
  const startMessage = () => {
    void run(async current => {
      const conversationID = await openConversation(id)
      if (current())
        router.push(`/chats/${encodeURIComponent(conversationID)}` as Href)
    })
  }
  const disabled = task.busy || self || blocked
  return (
    <ContactLayout
      title={more ? name : ''}
      {...task}
      // What this page shows depends on whether this is a friend, so it waits whole, behind a
      // placeholder drawn to its header and grouped cards (or just the cards on 更多).
      initialLoading={!task.hasSucceeded}
      skeleton={more ? 'settings' : 'profile'}
      onRetry={() => {
        void refresh()
      }}
      right={
        !more && !self ? (
          <ContactIconButton
            name='more'
            label='更多'
            onPress={() => router.push(`/chats/people/${encodeURIComponent(id)}/more` as Href)}
          />
        ) : undefined
      }
    >
      {loaded && !person && <Label>未找到该用户</Label>}
      {!!task.error && (
        <Action
          title='刷新'
          disabled={task.busy}
          onPress={() => {
            void refresh()
          }}
        />
      )}
      {person &&
        (more ? (
          <>
            <View style={{ height: 12 }} />
            <ContactInset>
              <View>
                <ProductCard>
                  <ProductRow
                    title={person.isFriend ? '设置备注' : '备注'}
                    trailing={value(person.isFriend ? person.remark || '未设置' : '仅好友可设置')}
                    onPress={
                      person.isFriend && !self && !task.busy ? () => setEditing(true) : undefined
                    }
                  />
                </ProductCard>
                {person.isFriend && (
                  <Text
                    style={{
                      color: t.text2,
                      fontSize: 13,
                      lineHeight: 19,
                      paddingHorizontal: 16,
                      paddingTop: 8,
                    }}
                  >
                    昵称由对方设置；备注只有你自己能看到。
                  </Text>
                )}
              </View>
              <View style={{ marginTop: 0 }}>
                <ProductCard>
                  <ProductRow
                    title='加入黑名单'
                    trailing={
                      <ProductSwitch
                        accessibilityLabel='加入黑名单'
                        disabled={task.busy || self}
                        value={blocked}
                        onValueChange={value => {
                          if (value)
                            setConfirm('block')
                          else
                            void run(async current => {
                              await profile.block(id, false)
                              if (current()) {
                                setBlocked(false)
                                setNotice('已移出黑名单')
                              }
                            })
                        }}
                      />
                    }
                  />
                </ProductCard>
              </View>
              {person.isFriend && !self && (
                <View style={{ marginTop: 0 }}>
                  <ProductCard>
                    <ProductRow
                      title='删除好友'
                      danger
                      centered
                      onPress={!task.busy ? () => setConfirm('delete') : undefined}
                    />
                  </ProductCard>
                </View>
              )}
            </ContactInset>
          </>
        ) : (
          <>
            <View
              style={{
                alignItems: 'center',
                paddingTop: 20,
                paddingHorizontal: 24,
                paddingBottom: 4,
              }}
            >
              <ProductAvatar id={id} title={name} uri={person.faceURL} size={96} />
              <Text
                style={{
                  color: t.text,
                  fontSize: 24,
                  lineHeight: 30,
                  letterSpacing: -0.3,
                  fontWeight: '700',
                  marginTop: 16,
                  textAlign: 'center',
                }}
              >
                {name}
              </Text>
              <Text
                selectable
                style={{ color: t.text2, fontSize: 14, lineHeight: 20, marginTop: 4, textAlign: 'center' }}
              >
                ID：{id}
              </Text>
            </View>
            {!self && (
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'center',
                  gap: 12,
                  marginTop: 22,
                  marginHorizontal: 16,
                }}
              >
                <ProfileAction
                  icon='chat'
                  title='发消息'
                  disabled={disabled}
                  onPress={startMessage}
                />
                <ProfileAction
                  icon='phone'
                  title='音视频通话'
                  disabled={disabled}
                  onPress={() => {
                    void run(async () => {
                      await calls.start(id, name, `imcall-${Crypto.randomUUID()}`)
                    })
                  }}
                />
              </View>
            )}
            <ContactSection>基本信息</ContactSection>
            <ContactInset>
              <ProductCard>
                <ProductRow title='昵称' trailing={value(person.nickname || id)} />
                {person.isFriend && (
                  <ProductRow title='备注' trailing={value(person.remark || '未设置')} />
                )}
                <ProductRow title='用户 ID' trailing={value(id)} />
                {self && <ProductRow title='邮箱' trailing={value(profileEmail(person))} />}
              </ProductCard>
              {blocked && (
                <Text style={{ color: t.text2 }}>已加入黑名单，无法向对方发送消息或发起通话。</Text>
              )}
              {!self && !person.isFriend && (
                <View style={{ marginTop: 0 }}>
                  <ProductButton
                    variant='soft'
                    title='添加到通讯录'
                    disabled={task.busy}
                    onPress={() =>
                      router.push({ pathname: '/chats/add-friend', params: { id } } as Href)
                    }
                  />
                </View>
              )}
            </ContactInset>
          </>
        ))}
      {editing && (
        <Confirm
          title='设置备注'
          message=''
          confirmLabel='确定'
          danger={false}
          busy={task.busy}
          error={task.error}
          onCancel={() => setEditing(false)}
          onConfirm={() => {
            void run(async current => {
              await profile.remark(id, remark)
              if (current()) {
                setPerson(user => user && { ...user, remark: remark.trim() })
                setNotice('好友备注已保存')
                setEditing(false)
              }
            })
          }}
        >
          <ProductPromptField
            accessibilityLabel='好友备注'
            placeholder='留空则清除备注'
            value={remark}
            onChangeText={setRemark}
            editable={!task.busy}
          />
        </Confirm>
      )}
      {confirm && (
        <Confirm
          title={confirm === 'delete' ? `删除好友 ${name}？` : '加入黑名单？'}
          confirmLabel={confirm === 'delete' ? '删除' : '加入'}
          error={task.error}
          message={
            confirm === 'delete'
              ? '删除后需要重新申请才能添加。'
              : '加入后将无法正常接收对方的消息。'
          }
          busy={task.busy}
          onCancel={() => setConfirm(undefined)}
          onConfirm={() => {
            void run(async current => {
              if (confirm === 'delete')
                await directory.removeFriend(id)
              else
                await profile.block(id, !blocked)
              if (!current())
                return
              setConfirm(undefined)
              if (confirm === 'delete') {
                setNotice('已删除好友')
                if (router.canGoBack())
                  router.dismiss(2)
                else
                  router.replace('/(tabs)/contacts')
              } else {
                setBlocked(!blocked)
                setNotice(blocked ? '已移出黑名单' : '已加入黑名单')
              }
            })
          }}
        />
      )}
    </ContactLayout>
  )
}
function ProfileAction ({
  icon,
  title,
  disabled,
  onPress,
}: {
  icon: 'chat' | 'phone'
  title: string
  disabled: boolean
  onPress: () => void
}) {
  const t = useProductTheme()
  return (
    <Pressable
      accessibilityRole='button'
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={{
        flex: 1,
        maxWidth: 168,
        height: 64,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
        backgroundColor: t.surface,
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <ProductIcon name={icon} size={24} color={t.accent} />
      <Text style={{ color: t.accent, fontSize: 12.5, fontWeight: '500' }}>{title}</Text>
    </Pressable>
  )
}
