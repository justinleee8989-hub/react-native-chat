import React, { useCallback, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { openConversation, useOpenIM } from '../application/store'
import LoginScreen from '../auth/LoginScreen'
import { HeaderAction, ProductHint } from '../groups/group-ui'
import { shortTime } from '../messages/presentation'
import { useTask } from '../shared/useTask'
import { ProductAvatar } from '../ui/primitives'
import { ProductPage, ProductEmpty } from '../ui/ProductPage'
import { useProductTheme } from '../ui/theme'
import { callAuthority } from './authority-api'
import { startConversationCall } from './CallControls'
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
export default function CallHistoryScreen () {
  const { session, config } = useOpenIM()
  return session ? (
    <History key={`${session.userID}:${session.imToken}`} session={session} url={config.chat} />
  ) : (
    <LoginScreen />
  )
}
function History ({
  session,
  url,
}: {
  session: NonNullable<ReturnType<typeof useOpenIM>['session']>
  url: string
}) {
  const { conversations } = useOpenIM()
  const t = useProductTheme()
  const [records, setRecords] = useState<ServerCall[]>([])
  const task = useTask()
  const { run } = task
  const refresh = useCallback(() => {
    void run(async current => {
      const result = await callAuthority(session, url, { action: 'list' })
      if (current())
        setRecords(result)
    })
  }, [run, session, url])
  useFocusEffect(refresh)
  return (
    <ProductPage
      title='通话记录'
      backHref='/(tabs)/me'
      white
      {...task}
      right={<HeaderAction title='刷新' disabled={task.busy} onPress={refresh} />}
    >
      {!records.length && !task.busy && !task.error && <ProductEmpty title='暂无通话记录' />}
      {records.map((call, index) => {
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
      {records.length > 0 && <ProductHint>近 24 小时，最多 100 条</ProductHint>}
    </ProductPage>
  )
}
