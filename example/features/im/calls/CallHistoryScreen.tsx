import React, { useCallback, useState } from 'react'
import { Platform, Pressable, Text, View } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { calls, openConversation, useOpenIM } from '../application/store'
import LoginScreen from '../auth/LoginScreen'
import { ProductHint } from '../groups/group-ui'
import type { MessageKey } from '../i18n'
import { useT } from '../i18n'
import { shortTime } from '../messages/presentation'
import { ProductError } from '../shared/product-error'
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
const labels: Record<string, MessageKey> = {
  ringing: 'callHistory.ringing',
  accepted: 'callHistory.inCall',
  ended: 'callHistory.ended',
  canceled: 'call.canceledShort',
  rejected: 'call.youRejected',
  missed: 'call.missed',
  disconnected: 'callHistory.dropped',
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
  const tr = useT()
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
      title={tr('tab.calls')}
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
          label={tr('common.refresh')}
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
        <ProductEmpty title={tr('callHistory.disabledTitle')} subtitle={tr('callHistory.disabledHint')} />
      )}
      {!unavailable && !records.length && (task.hasSucceeded || !!kept) && <ProductEmpty title={tr('callHistory.none')} />}
      {!unavailable && records.map((call, index) => {
        const peer = call.caller === session.userID ? call.callee : call.caller
        const conversation =
          call.groupID || peer
            ? conversations.find(item =>
              call.groupID ? item.groupID === call.groupID : item.userID === peer
            )
            : undefined
        const name =
          conversation?.showName || (call.groupID ? tr('callHistory.groupNamed', { id: call.groupID }) : peer || tr('call.title'))
        return (
          <Pressable
            key={call.room}
            accessibilityRole='button'
            accessibilityLabel={tr('callHistory.callAgain', { name })}
            disabled={task.busy}
            onPress={() => {
              void run(async current => {
                const targetID = call.groupID || peer
                if (!targetID)
                  throw new ProductError('callHistory.contactUnavailable')
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
                  {shortTime(call.ended || call.created, tr)}
                </Text>
              </View>
              <Text style={{ color: t.text2, fontSize: 13, lineHeight: 18 }}>
                {[tr(call.groupID ? 'call.group' : call.caller === session.userID ? 'callHistory.outgoing' : 'callHistory.incoming'), labels[call.status] ? tr(labels[call.status]) : call.status].join(' · ')}
                {call.connectedAt && call.durationSeconds !== undefined
                  ? ` · ${formatCallDuration(call.durationSeconds)}`
                  : ''}
              </Text>
            </View>
          </Pressable>
        )
      })}
      {!unavailable && records.length > 0 && <ProductHint>{tr('callHistory.window')}</ProductHint>}
    </ProductPage>
  )
}
