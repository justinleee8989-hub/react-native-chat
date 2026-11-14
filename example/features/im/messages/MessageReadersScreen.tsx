import React, { useCallback, useEffect, useState } from 'react'
import { View } from 'react-native'
import { useOpenIM } from '../application/store'
import LoginScreen from '../auth/LoginScreen'
import { Action, Label, Page, PersonRow, styles } from '../shared/shared'
import { useTask } from '../shared/useTask'
import { fetchMessageReaders, type ReadersResult } from './readers'

interface Props { id: string, messageID: string, seq: number }
export default function MessageReadersScreen (props: Props) {
  const { session } = useOpenIM()
  if (!session)
    return <LoginScreen />
  return <SessionReaders key={`${session.userID}:${session.imToken}:${props.id}:${props.messageID}`} {...props} />
}
function SessionReaders ({ id, messageID, seq }: Props) {
  const { session, config } = useOpenIM()
  const { busy, error, run } = useTask()
  const [result, setResult] = useState<ReadersResult>()
  const [read, setRead] = useState(false)
  const [limit, setLimit] = useState(50)
  const refresh = useCallback(() => {
    void run(async current => {
      const value = await fetchMessageReaders(session!, config.chat, id, messageID, seq)
      if (current())
        setResult(value)
    })
  }, [config.chat, id, messageID, run, seq, session])
  useEffect(() => {
    refresh()
  }, [refresh])
  const members = result?.members.filter(member => member.read === read) || []
  return (
    <Page title='群消息已读明细' busy={busy} error={error}>
      <Label>按当前群成员的会话已读进度统计；不含发送者和发送后加入的成员。已退群成员不在此列表中。</Label>
      <Action title='刷新已读状态' disabled={busy} onPress={refresh} />
      {result && <>
        <View style={styles.actions}>
          <Action
            title={`未读 ${result.unreadCount}`}
            disabled={!read}
            onPress={() => {
              setRead(false)
              setLimit(50)
            }}
          />
          <Action
            title={`已读 ${result.readCount}`}
            disabled={read}
            onPress={() => {
              setRead(true)
              setLimit(50)
            }}
          />
        </View>
        <Label>{read ? '已读成员' : '未读成员'}</Label>
        {!members.length && <Label>暂无{read ? '已读' : '未读'}成员</Label>}
        {members.slice(0, limit).map(member => <PersonRow key={member.userID} person={member} />)}
        {members.length > limit && <Action title='加载更多成员' onPress={() => setLimit(value => value + 50)} />}
        {!!result.excludedJoinedLater && <Label>已排除发送后加入的 {result.excludedJoinedLater} 名成员</Label>}
      </>}
    </Page>
  )
}
