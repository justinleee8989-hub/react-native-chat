import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Platform, StyleSheet, Text, View } from 'react-native'
import { type Href, useLocalSearchParams, useRouter } from 'expo-router'
import { contactDirectoryEvents, directory, findUserIDByContact } from '../application/directory'
import { profile } from '../application/profile'
import { useOpenIM } from '../application/store'
import LoginScreen from '../auth/LoginScreen'
import type { Person } from '../domain/directory'
import type { Session } from '../domain/types'
import { SettingField } from '../groups/group-ui'
import type { MessageKey } from '../i18n'
import { useT } from '../i18n'
import { showProductToast } from '../shared/ProductToast'
import { useDirectoryEvents } from '../shared/useDirectoryEvents'
import { useTask } from '../shared/useTask'
import { ProductAvatar, ProductButton, ProductCard, ProductRow, ProductSearch } from '../ui/primitives'
import { ProductEmpty } from '../ui/ProductPage'
import { useProductTheme } from '../ui/theme'
import { type ContactQuery, parseContactQuery } from './contact-query'
import { ContactIconButton, ContactInset, ContactLayout, ContactSection } from './ContactLayout'

export default function AddFriendScreen () {
  const { session, config } = useOpenIM()
  const { id } = useLocalSearchParams<{ id?: string }>()
  return session ? (
    <AddFriend
      key={`${session.userID}:${session.imToken}:${id || ''}`}
      session={session}
      chatURL={config.chat}
      initialID={id || ''}
    />
  ) : (
    <LoginScreen />
  )
}
const EMPTY: Record<ContactQuery['kind'], MessageKey> = {
  id: 'addFriend.checkID',
  email: 'addFriend.checkEmail',
  phone: 'addFriend.checkPhone',
}

function AddFriend ({ session, chatURL, initialID }: { session: Session, chatURL: string, initialID: string }) {
  const tr = useT()
  const { userID } = session
  const router = useRouter()
  const t = useProductTheme()
  const task = useTask()
  const { run } = task
  const [query, setQuery] = useState(initialID)
  const [message, setMessage] = useState(tr('addFriend.defaultMessage'))
  const [results, setResults] = useState<Person[]>([])
  const [searched, setSearched] = useState<ContactQuery['kind']>()
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
            setSearched(kind => kind ?? 'id')
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
      // An email or phone number is looked up on the chat server, which knows accounts' contacts;
      // the user it names is then read like a user ID typed in. A number nobody has as their phone
      // may still be someone's ID (an admin can choose IDs), so it is tried as one too.
      const parsed = parseContactQuery(query)
      const id = parsed.kind === 'id'
        ? parsed.userID
        : await findUserIDByContact(session, chatURL, parsed.kind === 'email'
          ? { email: parsed.email }
          : { areaCode: parsed.areaCode, phoneNumber: parsed.phoneNumber })
          ?? (parsed.kind === 'phone' ? query.trim() : undefined)
      const people = id ? await directory.users(id) : []
      const detailed = await Promise.all(
        people.map(async person => ({ ...person, ...(await profile.person(person.userID)) }))
      )
      if (current()) {
        resultIDs.current = detailed.map(person => person.userID)
        setResults(detailed)
        setSearched(parsed.kind)
      }
    })
  }
  return (
    <ContactLayout
      title={tr('addFriend.title')}
      {...task}
      // 扫一扫 sits in the header, as a scan action does in most apps; a browser cannot scan.
      right={Platform.OS === 'web' ? undefined : (
        <ContactIconButton name='scan' label={tr('contacts.scan')} onPress={() => router.push('/chats/scan' as Href)} />
      )}
    >
      <View style={styles.search}>
        <ProductSearch
          placeholder={tr('addFriend.searchPlaceholder')}
          accessibilityLabel={tr('addFriend.searchLabel')}
          returnKeyType='search'
          autoCapitalize='none'
          autoCorrect={false}
          value={query}
          onChangeText={value => {
            setQuery(value)
            setSearched(undefined)
            setResults([])
            resultIDs.current = []
          }}
          editable={!task.busy}
          onSubmitEditing={() => {
            if (query.trim())
              search()
          }}
        />
      </View>
      {searched && !results.length && (
        <ProductEmpty title={tr('addFriend.notFound')} subtitle={tr(EMPTY[searched])} />
      )}
      {results.map(person => {
        // Someone the user cannot add says why in light text on their row, instead of a disabled
        // button; only someone who can be added gets the note and the button.
        const status = person.userID === userID
          ? tr('addFriend.yourself')
          : person.isFriend
            ? tr('addFriend.alreadyFriend')
            : sent.includes(person.userID) ? tr('addFriend.requested') : undefined
        return (
          <React.Fragment key={person.userID}>
            <ContactSection>{tr('addFriend.results')}</ContactSection>
            <ContactInset>
              <ProductCard>
                <ProductRow
                  title={person.nickname || person.userID}
                  subtitle={tr('common.idLabel', { id: person.userID })}
                  leading={
                    <ProductAvatar
                      id={person.userID}
                      title={person.nickname || person.userID}
                      uri={person.faceURL}
                      size={48}
                    />
                  }
                  trailing={status ? <Text style={[styles.status, { color: t.text3 }]}>{status}</Text> : undefined}
                  onPress={() =>
                    router.push(`/chats/people/${encodeURIComponent(person.userID)}` as Href)
                  }
                />
                {!status && (
                  <SettingField
                    label={tr('addFriend.note')}
                    accessibilityLabel={tr('addFriend.noteLabel')}
                    placeholder={tr('addFriend.noteLabel')}
                    value={message}
                    onChangeText={setMessage}
                    editable={!task.busy}
                  />
                )}
              </ProductCard>
              {!status && (
                <ProductButton
                  title={tr('addFriend.send')}
                  disabled={task.busy}
                  onPress={() => {
                    void task.run(async current => {
                      await directory.add(person.userID, message)
                      if (current()) {
                        setSent(items => [...items, person.userID])
                        showProductToast(tr('addFriend.sent'))
                      }
                    })
                  }}
                />
              )}
            </ContactInset>
          </React.Fragment>
        )
      })}
    </ContactLayout>
  )
}

const styles = StyleSheet.create({
  search: { paddingTop: 8 },
  status: { fontSize: 14, lineHeight: 20 },
})
