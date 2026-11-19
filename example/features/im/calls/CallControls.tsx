import React, { useEffect, useState } from 'react'
import { Text, View } from 'react-native'
import * as Crypto from 'expo-crypto'
import { calls, sendTextChecked, useOpenIM } from '../application/store'
import { ProductHint } from '../groups/group-ui'
import type { MessageKey } from '../i18n'
import { useT } from '../i18n'
import { errorMessage } from '../shared/error-message'
import { ProductError } from '../shared/product-error'
import { Action } from '../shared/shared'
import { useTask } from '../shared/useTask'
import { ProductIcon } from '../ui/ProductIcon'
import { useProductTheme } from '../ui/theme'
import { callAuthority } from './authority-api'
import { CallMessageAction } from './CallMessage'
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
    throw new ProductError('call.endCurrentFirst')
  const call = await calls.group(conversation.groupID, Crypto.randomUUID())
  const invite = { room: call.room, expires: call.expires }
  try {
    await sendTextChecked(conversationID, formatCallInvitation(invite))
  } catch {
    const sameCall = calls.snapshot().active?.room === call.room
    if (sameCall)
      await calls.finish('end').catch(() => {})
    calls.notifyError(new ProductError(sameCall ? 'call.groupInviteFailedEnded' : 'call.groupInviteFailed'))
  }
}
export function StartCall ({ conversationID }: { conversationID: string }) {
  const tr = useT()
  const task = useTask()
  const { conversations } = useOpenIM()
  return (
    <>
      <Action
        title={tr('call.start')}
        disabled={task.busy}
        onPress={() => {
          void task.run(async () => {
            const conversation = conversations.find(
              item => item.conversationID === conversationID
            )
            if (!conversation)
              throw new ProductError('call.chatUnavailable')
            await startConversationCall(conversation, conversationID)
          })
        }}
      />
      {!!task.error && <ProductHint error>{task.error}</ProductHint>}
    </>
  )
}
export function JoinCall ({ text, own }: { text: string, own?: boolean }) {
  const tr = useT()
  const t = useProductTheme()
  const task = useTask()
  const { session, config } = useOpenIM()
  const invite = parseCallInvitation(text)
  const room = invite?.room
  // What the join button says: a text's key, or the failure that stopped the check.
  const [label, setLabel] = useState<MessageKey | Error>('call.checking')
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
          setLabel('call.join')
          setAvailable(true)
        }
      } catch (error) {
        if (current) {
          setLabel(error instanceof Error ? error : new ProductError('call.failed'))
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
  const labelText = typeof label === 'string' ? tr(label) : errorMessage(label, tr)
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
          <Text style={{ color, fontSize: 15, fontWeight: '600' }}>{tr('call.invitation')}</Text>
          <Text style={{ color, opacity: 0.7, fontSize: 12, marginTop: 3 }}>{tr('call.validFor')}</Text>
        </View>
      </View>
      <CallMessageAction
        label={labelText}
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
          <Text style={{ color, textAlign: 'center', fontSize: 14 }}>{labelText}</Text>
        </View>
      </CallMessageAction>
      {!!task.error && (
        <Text accessibilityRole='alert' style={{ color, fontSize: 13, lineHeight: 18, textAlign: 'center', padding: 12 }}>
          {task.error}
        </Text>
      )}
    </View>
  )
}
