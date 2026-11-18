import React, { useCallback, useRef, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { openConversation, useOpenIM } from '../application/store'
import LoginScreen from '../auth/LoginScreen'
import { HeaderAction, ProductHint } from '../groups/group-ui'
import { shortTime } from '../messages/presentation'
import { rememberedValue } from '../shared/remembered'
import { useTask } from '../shared/useTask'
import { ProductAvatar } from '../ui/primitives'
import { ProductPage, ProductEmpty } from '../ui/ProductPage'
import { useProductTheme } from '../ui/theme'
import { callAuthority } from './authority-api'
import { startConversationCall } from './CallControls'
import { isCallServiceUnavailable } from './errors'
import type { ServerCall } from './server-controller'
import { formatCallDuration } from './terminal-metadata'
const labels: Record<string, string> = {
  ringing: '等待接听',
  accepted: '通话中',
  ended: '已结束',
  canceled: '已取消',
  rejected: '已拒接',
  missed: '未接通话',
  disconnected: '异常断线已结束',
}
// Kept so that the list, mounted again on PC as navigation moves in and out of 通话, starts filled.
const remembered = rememberedValue<ServerCall[]>()
// Also kept: the page is mounted again on every visit, and each visit asked again only to be told
// the same thing.
const serviceOff = rememberedValue<boolean>()

/** The 通话 section's page: the tab on a phone, the master list on PC. */
export default function CallHistoryScreen () {
  const { session, config } = useOpenIM()
  return session ? (
    <History
      key={`${session.userID}:${session.imToken}`}
      account={`${session.userID}:${session.imToken}`}
      session={session}
      url={config.chat}
    />
  ) : (
    <LoginScreen />
  )
}
function History ({
  account,
  session,
  url,
}: {
  account: string
  session: NonNullable<ReturnType<typeof useOpenIM>['session']>
  url: string
}) {
  const { conversations } = useOpenIM()
  const t = useProductTheme()
  const [kept] = useState(() => remembered.get(account))
  const [records, setRecords] = useState<ServerCall[]>(kept ?? [])
  const [unavailable, setUnavailable] = useState(() => !!serviceOff.get(account))
  // Read in the focus callback: once the server has said it has no call service, coming back to the
  // page does not ask again. Only 刷新 or 重新加载 does.
  const unavailableRef = useRef(unavailable)
  const task = useTask()
  const { run } = task
  const load = useCallback(() => {
    void run(async current => {
      try {
        const result = await callAuthority(session, url, { action: 'list' })
        unavailableRef.current = false
        serviceOff.set(account, false)
        if (current()) {
          setUnavailable(false)
          setRecords(result)
          remembered.set(account, result)
        }
      } catch (error) {
        unavailableRef.current = isCallServiceUnavailable(error)
        serviceOff.set(account, unavailableRef.current)
        if (current())
          setUnavailable(unavailableRef.current)
        throw error
      }
    })
  }, [run, session, url, account])
  useFocusEffect(useCallback(() => {
    if (!unavailableRef.current)
      load()
  }, [load]))
  return (
    <ProductPage
      title='通话'
      root
      white
      {...task}
      error={unavailable ? '' : task.error}
      // Until the first answer, rows of the list's shape stand in for it; an empty state shown
      // first read as "no calls" and then jumped to the list.
      initialLoading={!task.hasSucceeded && !kept && !unavailable}
      onRetry={load}
      right={<HeaderAction title='刷新' disabled={task.busy} onPress={load} />}
    >
      {unavailable && (
        <ProductEmpty title='通话服务未启用' subtitle='当前服务器没有开启音视频通话，暂时无法查看通话记录或发起通话' />
      )}
      {!unavailable && !records.length && (task.hasSucceeded || !!kept) && <ProductEmpty title='暂无通话记录' />}
      {!unavailable && records.map((call, index) => {
        const peer = call.caller === session.userID ? call.callee : call.caller
        const conversation =
          call.groupID || peer
            ? conversations.find(item =>
              call.groupID ? item.groupID === call.groupID : item.userID === peer
            )
            : undefined
        const name =
          conversation?.showName || (call.groupID ? `群通话 ${call.groupID}` : peer || '音视频通话')
        return (
          <Pressable
            key={call.room}
            accessibilityRole='button'
            accessibilityLabel={`再次呼叫 ${name}`}
            disabled={task.busy}
            onPress={() => {
              void run(async current => {
                const targetID = call.groupID || peer
                if (!targetID)
                  throw new Error('通话联系人不可用')
                const id =
                  conversation?.conversationID ||
                  (await openConversation(targetID, call.groupID ? 3 : 1))
                if (current())
                  await startConversationCall(
                    { groupID: call.groupID, userID: peer, showName: name },
                    id
                  )
              })
            }}
            style={{
              flexDirection: 'row',
              paddingHorizontal: 20,
              height: 64,
              gap: 14,
              alignItems: 'center',
            }}
          >
            <ProductAvatar
              group={!!call.groupID}
              id={call.groupID || peer || call.room}
              title={name}
              uri={conversation?.faceURL}
              size={44}
            />
            <View
              style={{
                flex: 1,
                minWidth: 0,
                gap: 3,
                alignSelf: 'stretch',
                justifyContent: 'center',
                borderBottomWidth: index === records.length - 1 ? 0 : 0.5,
                borderColor: t.line,
              }}
            >
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                <Text
                  numberOfLines={1}
                  style={{
                    flex: 1,
                    fontSize: 16,
                    lineHeight: 22,
                    fontWeight: '600',
                    color: ['missed', 'rejected'].includes(call.status) ? t.danger : t.text,
                  }}
                >
                  {name}
                </Text>
                <Text style={{ fontSize: 12, color: t.text3 }}>
                  {shortTime(call.ended || call.created)}
                </Text>
              </View>
              <Text style={{ color: t.text2, fontSize: 13, lineHeight: 18 }}>
                {call.groupID ? '群通话' : call.caller === session.userID ? '呼出' : '呼入'} ·{' '}
                {labels[call.status] || call.status}
                {call.connectedAt && call.durationSeconds !== undefined
                  ? ` · ${formatCallDuration(call.durationSeconds)}`
                  : ''}
              </Text>
            </View>
          </Pressable>
        )
      })}
      {!unavailable && records.length > 0 && <ProductHint>近 24 小时，最多 100 条</ProductHint>}
    </ProductPage>
  )
}
