import React, { useCallback, useEffect, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import * as Crypto from 'expo-crypto'
import { type Href, useLocalSearchParams, useRouter } from 'expo-router'
import { contactDirectoryEvents, directory } from '../application/directory'
import { profile } from '../application/profile'
import { calls, openConversation, useOpenIM } from '../application/store'
import LoginScreen from '../auth/LoginScreen'
import type { Person } from '../domain/directory'
import { useT } from '../i18n'
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
  const tr = useT()
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
            label={tr('common.more')}
            onPress={() => router.push(`/chats/people/${encodeURIComponent(id)}/more` as Href)}
          />
        ) : undefined
      }
    >
      {loaded && !person && <Label>{tr('addFriend.notFound')}</Label>}
      {!!task.error && (
        <Action
          title={tr('common.refresh')}
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
                    title={person.isFriend ? tr('contacts.setRemark') : tr('person.remark')}
                    trailing={value(person.isFriend ? person.remark || tr('person.notSet') : tr('person.friendsOnly'))}
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
                    {tr('person.remarkHint')}
                  </Text>
                )}
              </View>
              <View style={{ marginTop: 0 }}>
                <ProductCard>
                  <ProductRow
                    title={tr('person.block')}
                    trailing={
                      <ProductSwitch
                        accessibilityLabel={tr('person.block')}
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
                                setNotice(tr('person.unblocked'))
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
                      title={tr('contacts.deleteFriend')}
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
                {tr('common.idLabel', { id })}
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
                  title={tr('contacts.message')}
                  disabled={disabled}
                  onPress={startMessage}
                />
                <ProfileAction
                  icon='phone'
                  title={tr('contacts.call')}
                  disabled={disabled}
                  onPress={() => {
                    void run(async () => {
                      await calls.start(id, name, `imcall-${Crypto.randomUUID()}`)
                    })
                  }}
                />
              </View>
            )}
            <ContactSection>{tr('person.basicInfo')}</ContactSection>
            <ContactInset>
              <ProductCard>
                <ProductRow title={tr('person.nickname')} trailing={value(person.nickname || id)} />
                {person.isFriend && (
                  <ProductRow title={tr('person.remark')} trailing={value(person.remark || tr('person.notSet'))} />
                )}
                <ProductRow title={tr('person.userID')} trailing={value(id)} />
                {self && <ProductRow title={tr('person.email')} trailing={value(profileEmail(person))} />}
              </ProductCard>
              {blocked && (
                <Text style={{ color: t.text2 }}>{tr('person.blockedNotice')}</Text>
              )}
              {!self && !person.isFriend && (
                <View style={{ marginTop: 0 }}>
                  <ProductButton
                    variant='soft'
                    title={tr('person.addToContacts')}
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
          title={tr('contacts.setRemark')}
          message=''
          confirmLabel={tr('common.ok')}
          danger={false}
          busy={task.busy}
          error={task.error}
          onCancel={() => setEditing(false)}
          onConfirm={() => {
            void run(async current => {
              await profile.remark(id, remark)
              if (current()) {
                setPerson(user => user && { ...user, remark: remark.trim() })
                setNotice(tr('person.remarkSaved'))
                setEditing(false)
              }
            })
          }}
        >
          <ProductPromptField
            accessibilityLabel={tr('contacts.remark')}
            placeholder={tr('contacts.remarkClearHint')}
            value={remark}
            onChangeText={setRemark}
            editable={!task.busy}
          />
        </Confirm>
      )}
      {confirm && (
        <Confirm
          title={confirm === 'delete' ? tr('contacts.deleteFriendTitle', { name }) : tr('person.blockTitle')}
          confirmLabel={confirm === 'delete' ? tr('contacts.removeConfirm') : tr('person.blockConfirm')}
          error={task.error}
          message={
            confirm === 'delete'
              ? tr('contacts.deleteFriendMessage')
              : tr('person.blockMessage')
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
                setNotice(tr('person.deleted'))
                if (router.canGoBack())
                  router.dismiss(2)
                else
                  router.replace('/(tabs)/contacts')
              } else {
                setBlocked(!blocked)
                setNotice(blocked ? tr('person.unblocked') : tr('person.blocked'))
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
