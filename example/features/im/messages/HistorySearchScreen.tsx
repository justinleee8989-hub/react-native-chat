import React from 'react'
import { Pressable, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useOpenIM } from '@/features/im/application/store'
import LoginScreen from '@/features/im/auth/LoginScreen'
import { HeaderAction, ProductHint } from '../groups/group-ui'
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
  const state = useOpenIM()
  const t = useProductTheme()
  const router = useRouter()
  const task = useHistorySearch(id)
  const { query, setQuery, searched, messages, hasMore, search } = task
  const conversation = state.conversations.find(item => item.conversationID === id)
  return (
    <ProductPage
      title='搜索聊天记录'
      white
      {...task}
      backHref='/chats'
      headerContent={
        <ProductSearch
          value={query}
          onChangeText={setQuery}
          placeholder='输入关键词'
          returnKeyType='search'
          onSubmitEditing={() => search()}
        />
      }
    >
      {!!task.error && <HeaderAction title='重试搜索' onPress={() => search()} />}
      {!searched && !task.error && (
        <ProductEmpty title={`搜索 ${conversation?.showName || '此会话'} 的聊天记录`} />
      )}
      {!!searched &&
        !task.error &&
        (messages.length ? (
          <ProductSection variant='list'>找到 {messages.length} 条相关消息</ProductSection>
        ) : hasMore ? (
          <ProductHint>本段记录没有匹配消息，可继续搜索更早记录</ProductHint>
        ) : (
          <ProductEmpty title='未找到匹配消息' />
        ))}
      {messages.map((message, index) => {
        const snippet =
          message.projection?.text ??
          message.textElem?.content ??
          message.atTextElem?.text ??
          message.quoteElem?.text ??
          ''
        const name = message.senderNickname || message.sendID || '未知联系人'
        return (
          <Pressable
            key={message.clientMsgID}
            accessibilityRole='button'
            accessibilityLabel={`查看消息：${snippet}`}
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
                  {message.sendTime ? shortTime(message.sendTime) : ''}
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
        <HeaderAction title='继续搜索更早记录' disabled={task.busy} onPress={() => search(true)} />
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
