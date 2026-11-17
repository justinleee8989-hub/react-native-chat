import React, { useEffect, useState } from 'react'
import { Text, View } from 'react-native'
import * as Crypto from 'expo-crypto'
import { calls, sendTextChecked, useOpenIM } from '../application/store'
import { Action, Label } from '../shared/shared'
import { useTask } from '../shared/useTask'
import { ProductIcon } from '../ui/ProductIcon'
import { useProductTheme } from '../ui/theme'
import { callAuthority } from './authority-api'
import { CallMessageAction } from './CallMessage'
import { safeCallErrorMessage } from './errors'
import { assertJoinableInvitation, formatCallInvitation, parseCallInvitation } from './invitation'
export async function startConversationCall (
  conversation: { groupID?: string, userID?: string, showName: string },
  conversationID: string
) {
  if (!conversation.groupID) {
    await calls.start(
      conversation.userID || '',
      conversation.showName,
      `imcall-${Crypto.randomUUID()}`
    )
    return
  }
  if (calls.snapshot().active)
    throw new Error('请先结束当前通话')
  const call = await calls.group(conversation.groupID, Crypto.randomUUID())
  const invite = { room: call.room, expires: call.expires }
  try {
    await sendTextChecked(conversationID, formatCallInvitation(invite))
  } catch (error) {
    const sameCall = calls.snapshot().active?.room === call.room
    if (sameCall)
      await calls.finish('end').catch(() => {})
    calls.notifyError(
      `群通话邀请未送达${sameCall ? '，本次通话已结束' : ''}：${safeCallErrorMessage(error, '请检查 IM 连接后重试')}`
    )
  }
}
export function StartCall ({ conversationID }: { conversationID: string }) {
  const task = useTask()
  const { conversations } = useOpenIM()
  return (
    <>
      <Action
        title='发起音视频通话'
        disabled={task.busy}
        onPress={() => {
          void task.run(async () => {
            const conversation = conversations.find(
              item => item.conversationID === conversationID
            )
            if (!conversation)
              throw new Error('会话已不可用，请刷新')
            await startConversationCall(conversation, conversationID)
          })
        }}
      />
      {!!task.error && <Label>{task.error}</Label>}
    </>
  )
}
export function JoinCall ({ text, own }: { text: string, own?: boolean }) {
  const t = useProductTheme()
  const task = useTask()
  const { session, config } = useOpenIM()
  const invite = parseCallInvitation(text)
  const room = invite?.room
  const [label, setLabel] = useState('检查通话状态')
  const [available, setAvailable] = useState(false)
  useEffect(() => {
    if (!room || !session)
      return
    let current = true
    const check = async () => {
      try {
        const result = await callAuthority(session, config.chat, { action: 'inspect', room })
        assertJoinableInvitation(result[0])
        if (current) {
          setLabel('加入通话')
          setAvailable(true)
        }
      } catch (error) {
        if (current) {
          setLabel(safeCallErrorMessage(error))
          setAvailable(false)
        }
      }
    }
    void check()
    const timer = setInterval(check, 10000)
    return () => {
      current = false
      clearInterval(timer)
    }
  }, [room, session, config.chat])
  if (!invite)
    return null
  const color = own ? t.onAccent : t.text
  return (
    <View style={{ minWidth: 230, maxWidth: 280 }}>
      <View style={{ padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View
          style={{
            width: 42,
            height: 42,
            borderRadius: 12,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: own ? '#ffffff33' : t.accentWeak,
          }}
        >
          <ProductIcon name='video' size={22} color={own ? t.onAccent : t.accent} />
        </View>
        <View>
          <Text style={{ color, fontSize: 15, fontWeight: '600' }}>音视频通话邀请</Text>
          <Text style={{ color, opacity: 0.7, fontSize: 12, marginTop: 3 }}>15 分钟内有效</Text>
        </View>
      </View>
      <CallMessageAction
        label={label}
        disabled={task.busy || !available}
        onPress={() => {
          void task.run(async () => {
            if (!session)
              return
            const result = await callAuthority(session, config.chat, {
              action: 'inspect',
              room: invite.room,
            })
            assertJoinableInvitation(result[0])
            await calls.join(invite.room)
          })
        }}
      >
        <View
          style={{
            paddingVertical: 11,
            paddingHorizontal: 14,
            borderTopWidth: 0.5,
            borderColor: own ? '#ffffff38' : t.line,
            opacity: task.busy || !available ? 0.6 : 1,
          }}
        >
          <Text style={{ color, textAlign: 'center', fontSize: 14 }}>{label}</Text>
        </View>
      </CallMessageAction>
      {!!task.error && (
        <Text accessibilityRole='alert' style={{ color, padding: 12 }}>
          {task.error}
        </Text>
      )}
    </View>
  )
}
