import React, { useCallback, useEffect, useState } from 'react'
import { View } from 'react-native'
import { useOpenIM } from '../application/store'
import LoginScreen from '../auth/LoginScreen'
import { Action, Label, Page } from '../shared/shared'
import { useTask } from '../shared/useTask'
import { callAuthority } from './authority-api'
import type { ServerCall } from './server-controller'
const labels: Record<string, string> = { ringing: '等待接听', accepted: '通话中', ended: '已结束', canceled: '已取消', rejected: '已拒接', missed: '未接通话', disconnected: '异常断线已结束' }
export default function CallHistoryScreen () {
  const { session, config } = useOpenIM()
  return session ? <History key={session.userID} session={session} url={config.chat} /> : <LoginScreen />
}
function History ({ session, url }: { session: NonNullable<ReturnType<typeof useOpenIM>['session']>, url: string }) {
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
  useEffect(refresh, [refresh])
  return <Page title='通话记录' {...task}>
    <Label>服务端记录 · 近 24 小时，最多 100 条</Label>
    <Action title='刷新记录' disabled={task.busy} onPress={refresh} />
    {!records.length && !task.busy && <Label>暂无通话记录</Label>}
    {records.map(call => <View key={call.room} style={{ gap: 8, paddingVertical: 12 }}>
      <Label>{call.groupID ? `群通话 ${call.groupID}` : call.caller === session.userID ? `呼出 ${call.callee}` : `呼入 ${call.caller}`}</Label>
      <Label>{labels[call.status] || call.status} · {new Date(call.created).toLocaleString('zh-CN')}</Label>
    </View>)}
  </Page>
}
