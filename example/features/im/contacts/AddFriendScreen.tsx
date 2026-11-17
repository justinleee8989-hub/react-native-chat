import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { type Href, useLocalSearchParams, useRouter } from 'expo-router'
import { contactDirectoryEvents, directory } from '../application/directory'
import { profile } from '../application/profile'
import { useOpenIM } from '../application/store'
import LoginScreen from '../auth/LoginScreen'
import type { Person } from '../domain/directory'
import { ProductHint, SettingField } from '../groups/group-ui'
import { showProductToast } from '../shared/ProductToast'
import { useDirectoryEvents } from '../shared/useDirectoryEvents'
import { useTask } from '../shared/useTask'
import { ProductAvatar, ProductButton, ProductCard, ProductRow } from '../ui/primitives'
import { ProductEmpty } from '../ui/ProductPage'
import { useProductTheme } from '../ui/theme'
import { ContactInset, ContactLayout, ContactSection } from './ContactLayout'

export default function AddFriendScreen () {
  const { session } = useOpenIM()
  const { id } = useLocalSearchParams<{ id?: string }>()
  return session ? (
    <AddFriend
      key={`${session.userID}:${session.imToken}:${id || ''}`}
      userID={session.userID}
      initialID={id || ''}
    />
  ) : (
    <LoginScreen />
  )
}
function AddFriend ({ userID, initialID }: { userID: string, initialID: string }) {
  const router = useRouter()
  const t = useProductTheme()
  const task = useTask()
  const { run } = task
  const [query, setQuery] = useState(initialID)
  const [message, setMessage] = useState('你好，希望添加你为好友')
  const [results, setResults] = useState<Person[]>([])
  const [searched, setSearched] = useState(false)
  const resultIDs = useRef<string[]>(initialID ? [initialID] : [])
  const [sent, setSent] = useState<string[]>([])
  const refreshPending = useCallback(
    () =>
      run(async current => {
        const pending: string[] = []
        let offset = 0
        while (current()) {
          const page = await directory.requests(false, offset)
          pending.push(
            ...page.filter(item => item.handleResult === 0).map(item => item.toUserID)
          )
          if (page.length < 30)
            break
          offset += page.length
        }
        const people = await Promise.all(resultIDs.current.map(id => profile.person(id)))
        if (current()) {
          setSent(pending)
          if (resultIDs.current.length) {
            setResults(people.filter(person => person !== undefined))
            setSearched(true)
          }
        }
      }),
    [run]
  )
  useDirectoryEvents(contactDirectoryEvents, refreshPending, task.busy)
  useEffect(() => {
    void refreshPending()
  }, [refreshPending])
  const search = () => {
    void task.run(async current => {
      const people = await directory.users(query.trim())
      const detailed = await Promise.all(
        people.map(async person => ({ ...person, ...(await profile.person(person.userID)) }))
      )
      if (current()) {
        resultIDs.current = detailed.map(person => person.userID)
        setResults(detailed)
        setSearched(true)
      }
    })
  }
  return (
    <ContactLayout title='添加好友' {...task}>
      <ContactSection>通过用户 ID 查找</ContactSection>
      <ContactInset>
        <ProductCard>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <SettingField
                placeholder='输入完整用户 ID'
                accessibilityLabel='完整用户 ID'
                value={query}
                onChangeText={value => {
                  setQuery(value)
                  setSearched(false)
                  setResults([])
                  resultIDs.current = []
                }}
                editable={!task.busy}
                onSubmitEditing={search}
              />
            </View>
            <Pressable
              accessibilityRole='button'
              disabled={task.busy || !query.trim()}
              onPress={search}
              style={{ paddingHorizontal: 16 }}
            >
              <Text
                style={{
                  color: task.busy || !query.trim() ? t.text3 : t.accent,
                  fontSize: 14,
                  fontWeight: '500',
                }}
              >
                查找
              </Text>
            </Pressable>
          </View>
        </ProductCard>
      </ContactInset>
      {!searched && <ProductHint>输入完整用户 ID，查找后发送好友申请。</ProductHint>}
      {searched && !results.length && (
        <ProductEmpty title='未找到该用户' subtitle='请检查用户 ID 是否完整' />
      )}
      {results.map(person => (
        <React.Fragment key={person.userID}>
          <ContactSection>查找结果</ContactSection>
          <ContactInset>
            <ProductCard>
              <ProductRow
                title={person.nickname || person.userID}
                subtitle={`ID：${person.userID}`}
                leading={
                  <ProductAvatar
                    id={person.userID}
                    title={person.nickname || person.userID}
                    uri={person.faceURL}
                    size={48}
                  />
                }
                onPress={() =>
                  router.push(`/chats/people/${encodeURIComponent(person.userID)}` as Href)
                }
              />
              {!person.isFriend && person.userID !== userID && !sent.includes(person.userID) && (
                <SettingField
                  label='申请说明'
                  accessibilityLabel='好友申请说明'
                  placeholder='好友申请说明'
                  value={message}
                  onChangeText={setMessage}
                  editable={!task.busy}
                />
              )}
            </ProductCard>
            <View style={{ marginTop: 0 }}>
              <ProductButton
                title={
                  person.userID === userID
                    ? '这是你自己'
                    : person.isFriend
                      ? '已经是好友'
                      : sent.includes(person.userID)
                        ? '已发送申请，等待对方处理'
                        : '发送好友申请'
                }
                disabled={
                  task.busy ||
                  person.userID === userID ||
                  person.isFriend ||
                  sent.includes(person.userID)
                }
                onPress={() => {
                  void task.run(async current => {
                    await directory.add(person.userID, message)
                    if (current()) {
                      setSent(items => [...items, person.userID])
                      showProductToast('好友申请已发送')
                    }
                  })
                }}
              />
            </View>
          </ContactInset>
        </React.Fragment>
      ))}
    </ContactLayout>
  )
}
