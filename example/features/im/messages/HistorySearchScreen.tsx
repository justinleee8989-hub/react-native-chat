import React from 'react'
import { Pressable, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useOpenIM } from '@/features/im/application/store'
import LoginScreen from '@/features/im/auth/LoginScreen'
import { HeaderAction, ProductHint } from '../groups/group-ui'
import { useT } from '../i18n'
import { ProductAvatar, ProductSearch } from '../ui/primitives'
import { ProductEmpty, ProductPage, ProductSection } from '../ui/ProductPage'
import { useProductTheme } from '../ui/theme'
import { shortTime } from './presentation'
import { useHistorySearch } from './useHistorySearch'

export default function HistorySearchScreen ({ id }: { id: string }) {
  const { session } = useOpenIM()
  if (!session)
    return <LoginScreen />
  return <SessionHistorySearch key={`${session.userID}:${session.imToken}:${id}`} id={id} />
}

function SessionHistorySearch ({ id }: { id: string }) {
  const tr = useT()
  const state = useOpenIM()
  const t = useProductTheme()
  const router = useRouter()
  const task = useHistorySearch(id)
  const { query, setQuery, searched, messages, hasMore, search } = task
  const conversation = state.conversations.find(item => item.conversationID === id)
  return (
    <ProductPage
      title={tr('chatInfo.searchHistory')}
      white
      {...task}
      backHref='/chats'
      headerContent={
        <ProductSearch
          value={query}
          onChangeText={setQuery}
          placeholder={tr('search.placeholder')}
          returnKeyType='search'
          onSubmitEditing={() => search()}
        />
      }
    >
      {!!task.error && <HeaderAction title={tr('search.retry')} onPress={() => search()} />}
      {!searched && !task.error && (
        <ProductEmpty title={tr('search.prompt', { name: conversation?.showName || tr('search.thisChat') })} />
      )}
      {!!searched &&
        !task.error &&
        (messages.length ? (
          <ProductSection variant='list'>{tr('search.found', { count: messages.length })}</ProductSection>
        ) : hasMore ? (
          <ProductHint>{tr('search.noneHere')}</ProductHint>
        ) : (
          <ProductEmpty title={tr('search.none')} />
        ))}
      {messages.map((message, index) => {
        const snippet =
          message.projection?.text ??
          message.textElem?.content ??
          message.atTextElem?.text ??
          message.quoteElem?.text ??
          ''
        const name = message.senderNickname || message.sendID || tr('message.unknownSender')
        return (
          <Pressable
            key={message.clientMsgID}
            accessibilityRole='button'
            accessibilityLabel={tr('search.viewMessage', { text: snippet })}
            onPress={() =>
              router.dismissTo({
                pathname: '/chats/[id]',
                params: { id, messageID: message.clientMsgID },
              })
            }
            style={{
              flexDirection: 'row',
              gap: 14,
              paddingHorizontal: 20,
              height: 64,
              alignItems: 'center',
            }}
          >
            <ProductAvatar
              id={message.sendID || ''}
              title={name}
              uri={message.senderFaceUrl}
              size={40}
            />
            <View
              style={{
                flex: 1,
                minWidth: 0,
                gap: 3,
                alignSelf: 'stretch',
                justifyContent: 'center',
                borderBottomWidth: index === messages.length - 1 ? 0 : 0.5,
                borderColor: t.line,
              }}
            >
              <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                <Text
                  numberOfLines={1}
                  style={{
                    flex: 1,
                    fontSize: 14,
                    lineHeight: 22,
                    fontWeight: '500',
                    color: t.text2,
                  }}
                >
                  {name}
                </Text>
                <Text style={{ fontSize: 12, color: t.text3 }}>
                  {message.sendTime ? shortTime(message.sendTime, tr) : ''}
                </Text>
              </View>
              <Text numberOfLines={1} style={{ flex: 1, fontSize: 15, lineHeight: 20, color: t.text }}>
                <SearchHighlight text={snippet} keyword={searched} color={t.danger} />
              </Text>
            </View>
          </Pressable>
        )
      })}
      {hasMore && (
        <HeaderAction title={tr('search.earlier')} disabled={task.busy} onPress={() => search(true)} />
      )}
    </ProductPage>
  )
}

function SearchHighlight ({
  text,
  keyword,
  color,
}: {
  text: string
  keyword: string
  color: string
}) {
  if (!keyword)
    return <>{text}</>
  const parts: React.ReactNode[] = []
  const lower = text.toLowerCase(),
        query = keyword.toLowerCase()
  let cursor = 0
  let index = lower.indexOf(query)
  while (index >= 0) {
    parts.push(
      text.slice(cursor, index),
      <Text key={index} style={{ color }}>
        {text.slice(index, index + keyword.length)}
      </Text>
    )
    cursor = index + keyword.length
    index = lower.indexOf(query, cursor)
  }
  parts.push(text.slice(cursor))
  return <>{parts}</>
}
