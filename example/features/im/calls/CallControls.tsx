import React, { useEffect, useState } from 'react'
import * as Crypto from 'expo-crypto'
import { calls, sendTextChecked, useOpenIM } from '../application/store'
import { Action, Label } from '../shared/shared'
import { useTask } from '../shared/useTask'
import { callAuthority } from './authority-api'
import { safeCallErrorMessage } from './errors'
import { assertJoinableInvitation, formatCallInvitation, parseCallInvitation } from './invitation'
export function StartCall ({ conversationID }: { conversationID: string }) {
  const task = useTask()
  const { conversations } = useOpenIM()
  return <>
    <Action title='发起音视频通话' disabled={task.busy} onPress={() => {
      void task.run(async () => {
        const conversation = conversations.find(item => item.conversationID === conversationID)
        if (!conversation)
          throw new Error('会话已不可用，请刷新')
        if (!conversation.groupID) {
          await calls.start(conversation.userID || '', conversation.showName, `imcall-${Crypto.randomUUID()}`)
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
          calls.notifyError(`群通话邀请未送达${sameCall ? '，本次通话已结束' : ''}：${safeCallErrorMessage(error, '请检查 IM 连接后重试')}`)
        }
      }) 
    }}
    />
    {!!task.error && <Label>{task.error}</Label>}
  </>
}
export function JoinCall ({ text }: { text: string }) {
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
          setLabel('加入音视频通话'); setAvailable(true) 
        }
      } catch (error) {
        if (current) {
          setLabel(safeCallErrorMessage(error)); setAvailable(false) 
        }
      }
    }
    void check()
    const timer = setInterval(check, 10000)
    return () => {
      current = false; clearInterval(timer) 
    }
  }, [room, session, config.chat])
  if (!invite)
    return null
  return <>
    <Action title={label} disabled={task.busy || !available} onPress={() => {
      void task.run(async () => {
        if (!session) 
          return
        const result = await callAuthority(session, config.chat, { action: 'inspect', room: invite.room })
        assertJoinableInvitation(result[0])
        await calls.join(invite.room)
      })
    }}
    />
    {!!task.error && <Label>{task.error}</Label>}
  </>
}
