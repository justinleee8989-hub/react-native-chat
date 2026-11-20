import React, { useCallback, useLayoutEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import type { ChatProps, IMessage, MessageMenuItem } from '@kesha-antonov/react-native-chat'
import { useRouter } from 'expo-router'
import { calls, loadServerHistory, reportError, retryMessage } from '@/features/im/application/store'
import { toMessage } from '@/features/im/domain/model'
import type { GroupMessageReadInfo, IMMessage } from '@/features/im/domain/types'
import { parseCallInvitation } from '../calls/invitation'
import { messageCallSignal, projectCallMessages } from '../calls/message-projection'
import { useT } from '../i18n'
import { resolveExtraSequence } from './extras'
import { MessageCustomContent } from './MessageCustomContent'
import { groupReadCount } from './presentation'
import { ProductBubble, ProductMessage } from './ProductMessage'

/** A message as the list gets it: the projected chat message plus its raw OpenIM message. */
type RowMessage = IMessage & { imRaw?: IMMessage, imReadCount?: number }
const rawOf = (message: IMessage) => (message as RowMessage).imRaw

const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏']
const renderNothing = () => null
const renderBubble: NonNullable<ChatProps<IMessage>['renderBubble']> = props => <ProductBubble {...props} />

/**
 * The messages and everything a message row is rendered with, for the chat page's `Chat`.
 *
 * The chat page re-renders on any change in the IM store (focus marking the chat read, presence,
 * typing...), and the SDK re-renders every mounted row when one of these props changes identity:
 * rebuilt on each render they cost ~100ms per render in a long chat, several times while a chat
 * opened. So each keeps its identity until something every row shows changes, and what is per
 * message (raw OpenIM message, read count) travels on the message itself: when one message
 * changes, only its own row re-renders.
 */
export function useChatRows ({
  id,
  messageID,
  rawMessages,
  extras,
  readInfo,
  selfID,
  isGroup,
  rowWidth,
  lastOwnMessageID,
  requestCall,
  onRevoke,
}: {
  id: string
  /** A message being located, kept even when call projection would fold it away. */
  messageID?: string
  rawMessages: IMMessage[]
  extras: { map: (message: IMessage) => IMessage, react: (message: IMessage, emoji: string) => void }
  readInfo?: Record<string, GroupMessageReadInfo>
  selfID: string
  isGroup: boolean
  rowWidth?: number
  lastOwnMessageID?: string
  requestCall: () => void
  onRevoke: (clientMsgID: string) => void
}) {
  const tr = useT()
  const router = useRouter()

  // Typed as IMessage[] so `Chat` keeps IMessage as its message type.
  const extrasMap = extras.map
  // A call ended here shows as ended at once, not when the server's record of it arrives.
  const callOutcomes = useSyncExternalStore(calls.subscribe, () => calls.snapshot().outcomes)
  const messages = useMemo<IMessage[]>(() => {
    // A call keeps one row, keyed by its room, whichever of its messages the row shows: when the
    // call ends the server's record replaces the invitation under a new ID, and as a new row it
    // was laid out at an estimated height, then measured, and the list jumped. Under the same key
    // it keeps the row's height and the list stays put.
    const callRows = new Set<string>()
    return projectCallMessages(rawMessages, messageID ? [messageID] : [], callOutcomes).map((message): RowMessage => {
      const room = messageCallSignal(message)?.room
      const listKey = room && !callRows.has(room) ? `call:${room}` : undefined
      if (room)
        callRows.add(room)
      const mapped: RowMessage = {
        ...extrasMap(toMessage(message, tr)),
        ...(listKey ? { listKey } : {}),
        imRaw: message,
        imReadCount: groupReadCount(message, readInfo?.[message.clientMsgID]?.readCount),
      }
      if (
        (message.contentType === 108 && !!message.cardElem?.userID) ||
        (message.contentType === 109 &&
          message.locationElem &&
          Number.isFinite(message.locationElem.latitude) &&
          Math.abs(message.locationElem.latitude) <= 90 &&
          Number.isFinite(message.locationElem.longitude) &&
          Math.abs(message.locationElem.longitude) <= 180)
      )
        return { ...mapped, text: '' }
      return messageCallSignal(message) || parseCallInvitation(message.textElem?.content || '')
        ? { ...mapped, text: '' }
        : mapped
    })
  }, [rawMessages, messageID, callOutcomes, extrasMap, readInfo, tr])

  const latestRequestCall = useRef(requestCall)
  useLayoutEffect(() => {
    latestRequestCall.current = requestCall
  })
  const callFromRow = useCallback(() => latestRequestCall.current(), [])

  // The readers page needs the message's server seq. A message just sent has none yet (it comes
  // with the next sync), and opening the page then failed with "消息尚未同步"; resolve it from
  // server history first, as editing and reactions already do.
  const openReaders = useCallback((message: IMessage) => {
    const raw = rawOf(message)
    if (!raw)
      return
    void (async () => {
      const seq = await resolveExtraSequence(raw, cursor => loadServerHistory({ conversationID: id, cursor }))
      router.push({
        pathname: '/chats/readers/[id]',
        params: { id, messageID: String(message._id), seq: String(seq) },
      })
    })().catch(reportError)
  }, [id, router])

  const renderMessage = useCallback<NonNullable<ChatProps<IMessage>['renderMessage']>>(props => (
    <ProductMessage
      {...props}
      containerWidth={rowWidth}
      onRetry={message => {
        const raw = rawOf(message)
        if (raw)
          void retryMessage(id, raw).catch(reportError)
      }}
      readCount={(props.currentMessage as RowMessage).imReadCount}
      lastOwnID={lastOwnMessageID}
      group={isGroup}
      onReaders={openReaders}
    />
  ), [rowWidth, lastOwnMessageID, isGroup, openReaders, id])

  const renderCustomView = useCallback<NonNullable<ChatProps<IMessage>['renderCustomView']>>(({ currentMessage }) => (
    <MessageCustomContent
      self={selfID}
      message={currentMessage ? rawOf(currentMessage) : undefined}
      onCall={callFromRow}
      onError={reportError}
    />
  ), [selfID, callFromRow])

  const messageActions = useCallback((message: IMessage, defaults: MessageMenuItem[]) => {
    const raw = rawOf(message)
    if (!raw || raw.contentType >= 1000)
      return []
    const actions = defaults.filter(
      action =>
        ['copy', 'retry'].includes(action.key || '') ||
        (raw.status === 2 && ['reply', 'forward'].includes(action.key || '')) ||
        (raw.status === 2 &&
          raw.contentType === 101 &&
          raw.sendID === selfID &&
          !parseCallInvitation(raw.textElem?.content || '') &&
          !messageCallSignal(raw) &&
          action.key === 'edit')
    )
    if (raw.sendID === selfID && raw.status === 2)
      actions.push({
        key: 'revoke',
        label: tr('message.revoke'),
        destructive: true,
        onPress: () => onRevoke(raw.clientMsgID),
      })
    if (
      raw.groupID &&
      raw.sendID === selfID &&
      raw.status === 2 &&
      (raw.seq || 0) > 0
    )
      actions.push({
        key: 'readers',
        label: tr('message.readers'),
        onPress: () =>
          router.push({
            pathname: '/chats/readers/[id]',
            params: { id, messageID: raw.clientMsgID, seq: String(raw.seq) },
          }),
      })
    const order = ['retry', 'reply', 'copy', 'forward', 'edit', 'readers', 'revoke']
    return actions.sort((a, b) => order.indexOf(a.key || '') - order.indexOf(b.key || ''))
  }, [selfID, onRevoke, router, id, tr])

  const reactRow = extras.react
  const reactions = useMemo(() => ({
    isEnabled: true,
    emojis: REACTION_EMOJIS,
    onReactionPress: reactRow,
    renderExpandedPicker: null,
  }), [reactRow])

  return {
    messages,
    renderMessage,
    renderBubble,
    renderCustomView,
    renderDay: renderNothing,
    renderChatEmpty: renderNothing,
    messageActions,
    reactions,
  }
}
