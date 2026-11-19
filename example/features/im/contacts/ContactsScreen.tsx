import React, { useCallback, useEffect, useRef, useState } from 'react'
import { type ScrollView, Text, View } from 'react-native'
import { type Href, useRouter } from 'expo-router'
import { directory, contactDirectoryEvents, groupDirectoryEvents } from '../application/directory'
import { groupApplicationEvents, groupManagement } from '../application/group-management'
import { useOpenIM } from '../application/store'
import LoginScreen from '../auth/LoginScreen'
import { mergeDirectory, type Person } from '../domain/directory'
import { useT } from '../i18n'
import { useMasterNavigation } from '../navigation/DesktopNavigation'
import { rememberedValue } from '../shared/remembered'
import { Action } from '../shared/shared'
import { useDirectoryEvents } from '../shared/useDirectoryEvents'
import { useTask } from '../shared/useTask'
import { ProductAvatar, ProductListRow, ProductSearch } from '../ui/primitives'
import { ProductIcon } from '../ui/ProductIcon'
import { ProductEmpty } from '../ui/ProductPage'
import { ProductSkeleton } from '../ui/ProductSkeleton'
import { useProductTheme } from '../ui/theme'
import { groupByInitial } from './contact-index'
import { directorySummary } from './contact-summary'
import { ContactActions } from './ContactActions'
import { ContactIconButton, ContactLayout, ContactSection } from './ContactLayout'
import { LetterHeader, LetterIndex } from './LetterIndex'

// Below this many friends the letter index would light only two or three letters; the list stays flat.
const INDEX_MIN_FRIENDS = 10
const nameOf = (person: Person) => person.remark || person.nickname || person.userID

const events = [
  ...new Set([...contactDirectoryEvents, ...groupDirectoryEvents, ...groupApplicationEvents]),
]
const remembered = rememberedValue<{
  friends: Person[]
  more: boolean
  pending: number
  groups: number
  groupPending: number
}>()

export default function ContactsScreen ({ root = false }: { root?: boolean }) {
  const { session } = useOpenIM()
  return session ? (
    <Contacts root={root} account={`${session.userID}:${session.imToken}`} key={`${session.userID}:${session.imToken}`} />
  ) : (
    <LoginScreen />
  )
}
function Contacts ({ root, account }: { root: boolean, account: string }) {
  const tr = useT()
  const router = useRouter()
  const openMaster = useMasterNavigation()
  const open = root ? openMaster : (href: Href) => router.push(href)
  const t = useProductTheme()
  const task = useTask()
  const { run } = task
  const [kept] = useState(() => remembered.get(account))
  const [friends, setFriends] = useState<Person[]>(kept?.friends ?? [])
  const [pending, setPending] = useState(kept?.pending ?? 0)
  const [groups, setGroups] = useState(kept?.groups ?? 0)
  const [groupPending, setGroupPending] = useState(kept?.groupPending ?? 0)
  const [selected, setSelected] = useState<Person>()
  const [offset, setOffset] = useState(kept?.friends.length ?? 0)
  const [more, setMore] = useState(kept?.more ?? false)
  const [query, setQuery] = useState('')
  const refresh = useCallback(
    () =>
      run(async current => {
        const [people, requests, groupCount, groupRequests] = await Promise.all([
          directory.friends(),
          directorySummary(
            offset => directory.requests(true, offset),
            current,
            item => item.handleResult === 0
          ),
          directorySummary(directory.groups, current),
          directorySummary(
            offset => groupManagement.requests(true, offset),
            current,
            item => item.handleResult === 0
          ),
        ])
        if (!current())
          return
        setFriends(people)
        setOffset(people.length)
        setMore(people.length === 30)
        setPending(requests)
        setGroups(groupCount)
        setGroupPending(groupRequests)
        remembered.set(account, { friends: people, more: people.length === 30, pending: requests, groups: groupCount, groupPending: groupRequests })
      }),
    [run, account]
  )
  useDirectoryEvents(events, refresh, task.busy)
  useEffect(() => {
    void refresh()
  }, [refresh])
  const q = query.trim().toLocaleLowerCase()
  // Pinyin order, the same on every platform (see contact-index.ts).
  const sections = groupByInitial(
    friends.filter(person =>
      [person.nickname, person.remark, person.userID].some(value =>
        value?.toLocaleLowerCase().includes(q)
      )
    ),
    nameOf
  )
  const visible = sections.flatMap(section => section.items)
  const indexed = !q && friends.length >= INDEX_MIN_FRIENDS && sections.length > 1
  // Each letter heading's offset in the scroll content: where the index jumps to.
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null)
  const offsets = useRef(new Map<string, number>())
  const jump = (letter: string) => {
    const y = offsets.current.get(letter)
    if (y !== undefined)
      scroll.current?.scrollTo({ y, animated: false })
  }
  const row = (person: Person, last: boolean) => (
    <ProductListRow
      small
      side={root}
      last={last}
      key={person.userID}
      title={nameOf(person)}
      subtitle={person.remark ? tr('contacts.nicknameIs', { name: person.nickname || person.userID }) : undefined}
      leading={
        <ProductAvatar
          id={person.userID}
          title={nameOf(person)}
          uri={person.faceURL}
          size={44}
        />
      }
      trailing={<View />}
      onLongPress={() => setSelected(person)}
      onPress={() => open(`/chats/people/${encodeURIComponent(person.userID)}` as Href)}
    />
  )
  const tile = (name: 'userPlus' | 'users') => (
    <View
      style={{
        width: 44,
        height: 44,
        backgroundColor: t.surface2,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <ProductIcon name={name} color={t.text} />
    </View>
  )
  const badge = (count: number) => (
    <Text
      style={{ color: '#fff', backgroundColor: t.danger, borderRadius: 10, paddingHorizontal: 6 }}
    >
      {count}
    </Text>
  )
  const loading = !task.hasSucceeded && !kept
  const letterIndex = indexed && !loading
    ? <LetterIndex letters={sections.map(section => section.letter)} onSelect={jump} />
    : undefined
  return (
    <ContactLayout
      white
      root={root}
      title={tr('tab.contacts')}
      {...task}
      // Search, 新的朋友 and 群聊 show from the first frame; only the friend rows wait for data. A
      // whole-page skeleton was swapped for a differently shaped page once friends arrived.
      loading={loading}
      scrollRef={scroll}
      overlay={letterIndex}
      right={
        <ContactIconButton
          name='userPlus'
          label={tr('addFriend.title')}
          onPress={() => open('/chats/add-friend' as Href)}
        />
      }
    >
      <ProductSearch side={root} placeholder={tr('contacts.searchFriends')} value={query} onChangeText={setQuery} />
      {!q && (
        <>
          <ProductListRow
            small
            side={root}
            chevron
            titleWeight='500'
            title={tr('contacts.newFriends')}
            leading={tile('userPlus')}
            trailing={pending ? badge(pending) : undefined}
            onPress={() => open('/chats/friend-requests' as Href)}
          />
          <ProductListRow
            small
            side={root}
            chevron
            titleWeight='500'
            title={tr('contacts.groupChats')}
            leading={tile('users')}
            trailing={
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                {groupPending ? (
                  badge(groupPending)
                ) : groups ? (
                  <Text style={{ color: t.text3 }}>{groups}</Text>
                ) : null}
              </View>
            }
            onPress={() => open('/chats/groups' as Href)}
          />
        </>
      )}
      <ContactSection variant='list' side={root}>
        {q ? tr('contacts.searchResults') : tr('contacts.friends')}
        {loading ? '' : ` · ${visible.length}`}
        {more ? tr('contacts.loadedSoFar') : ''}
      </ContactSection>
      {loading && !task.error && <ProductSkeleton kind='list' small />}
      {indexed
        ? sections.map(section => (
          <React.Fragment key={section.letter}>
            <LetterHeader
              letter={section.letter}
              side={root}
              onLayout={y => offsets.current.set(section.letter, y)}
            />
            {section.items.map((person, index) => row(person, index === section.items.length - 1))}
          </React.Fragment>
        ))
        : visible.map((person, index) => row(person, index === visible.length - 1))}
      {!loading && !visible.length && !task.busy && (
        <ProductEmpty
          title={q ? tr('contacts.noMatch') : tr('contacts.noFriends')}
          subtitle={q ? undefined : tr('contacts.addHint')}
        />
      )}
      {more && (
        <Action
          title={tr('friendPicker.loadMore')}
          disabled={task.busy}
          onPress={() => {
            void run(async current => {
              const page = await directory.friends(offset)
              if (current()) {
                setFriends(items => mergeDirectory(items, page, item => item.userID))
                setOffset(offset + page.length)
                setMore(page.length === 30)
              }
            })
          }}
        />
      )}
      {!!task.error && (
        <Action
          title={tr('common.reload')}
          disabled={task.busy}
          onPress={() => {
            void refresh()
          }}
        />
      )}
      {selected && (
        <ContactActions
          person={selected}
          onClose={() => setSelected(undefined)}
          onChanged={() => {
            void refresh()
          }}
        />
      )}
    </ContactLayout>
  )
}
