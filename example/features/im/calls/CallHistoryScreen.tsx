import React, { useCallback, useState } from 'react'
import { Platform, Pressable, Text, View } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { calls, openConversation, useOpenIM } from '../application/store'
import LoginScreen from '../auth/LoginScreen'
import { ProductHint } from '../groups/group-ui'
import { shortTime } from '../messages/presentation'
import { rememberedValue } from '../shared/remembered'
import { useTask } from '../shared/useTask'
import { ProductAvatar } from '../ui/primitives'
import { ProductEmpty, ProductIconButton, ProductPage } from '../ui/ProductPage'
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
// Also kept, so a visit after the server said it has no call service shows that at once instead of
// the skeleton; the visit still asks once, quietly, in case the service has been turned on since.
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
  const task = useTask()
  const { run } = task
  const [pulling, setPulling] = useState(false)
  const load = useCallback(() => run(async current => {
    try {
      const result = await callAuthority(session, url, { action: 'list' })
      serviceOff.set(account, false)
      // The service is back: incoming calls are watched again without signing in again.
      calls.serviceAnswered()
      if (current()) {
        setUnavailable(false)
        setRecords(result)
        remembered.set(account, result)
      }
    } catch (error) {
      const off = isCallServiceUnavailable(error)
      serviceOff.set(account, off)
      if (current())
        setUnavailable(off)
      throw error
    }
  }), [run, session, url, account])
  // One request per visit, also while the service is off: entering the page is the user asking.
  useFocusEffect(useCallback(() => {
    void load()
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
      onRetry={() => {
        void load()
      }}
      // Refreshed by pulling the list, like 消息; the page also reloads on every visit. The browser
      // has no pull-to-refresh, so it keeps a refresh button there.
      right={Platform.OS === 'web' ? (
        <ProductIconButton
          name='retry'
          label='刷新'
          busy={task.busy}
          onPress={() => {
            void load()
          }}
        />
      ) : undefined}
      // The header button shows the browser's reload, so the page's own floating spinner stays away.
      refreshing={pulling || (Platform.OS === 'web' && task.busy)}
      onRefresh={() => {
        setPulling(true)
        void load().finally(() => setPulling(false))
      }}
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
