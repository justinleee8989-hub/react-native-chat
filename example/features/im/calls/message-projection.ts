import type { IMMessage } from '../domain/types'
import type { Translate } from '../i18n/translate.ts'
import { readReply } from '../messages/composer.ts'
import { encodeSignal, parseSignal, type CallSignal } from './signaling.ts'

export function messageCallSignal (message?: IMMessage) {
  return message?.contentType === 101 && !message.groupID ? parseSignal(message.textElem?.content || '') : undefined
}
const terminal = new Set(['cancel', 'reject', 'end', 'missed', 'busy', 'disconnected'])
function keyFor (message: IMMessage) {
  const signal = messageCallSignal(message)
  if (!signal || message.status !== 2 || !message.sendID || !message.recvID)
    return undefined
  return JSON.stringify([[message.sendID, message.recvID].sort(), signal.room, signal.expires])
}
// This is a view only: the surviving row retains its real SDK ID and sender so
// revoke, reply, forwarding and read receipts never target a synthetic message.
//
// `outcomes` (by room) are how calls ended by the server's answer, before its record of them
// arrives: until then the call's invitation shows that ending.
export function projectCallMessages (messages: IMMessage[], preservedIDs: string[] = [], outcomes: Record<string, CallSignal> = {}) {
  messages = withOutcomes(messages, outcomes)
  const preserved = new Set(preservedIDs)
  for (const message of messages) {
    const quoted = message.quoteElem?.quoteMessage || readReply(message)
    if (quoted)
      preserved.add(quoted.clientMsgID)
  }
  const latest = new Map<string, IMMessage>()
  for (const message of messages) {
    const key = keyFor(message)
    const signal = messageCallSignal(message)
    if (!key || !signal || !terminal.has(signal.kind))
      continue
    const previous = latest.get(key)
    const server = signal.version === 2
    const previousServer = messageCallSignal(previous)?.version === 2
    if (!previous || server && !previousServer || server === previousServer && (message.sendTime > previous.sendTime || (message.sendTime === previous.sendTime && message.clientMsgID > previous.clientMsgID)))
      latest.set(key, message)
  }
  return messages.filter(message => {
    const key = keyFor(message)
    const final = key ? latest.get(key) : undefined
    return preserved.has(message.clientMsgID) || !final || final === message || messageCallSignal(final)?.version !== 2 && message.sendTime > final.sendTime
  })
}
function withOutcomes (messages: IMMessage[], outcomes: Record<string, CallSignal>) {
  if (!Object.keys(outcomes).length)
    return messages
  const recorded = new Set<string>()
  for (const message of messages) {
    const signal = messageCallSignal(message)
    if (signal?.version === 2)
      recorded.add(signal.room)
  }
  return messages.map(message => {
    const signal = messageCallSignal(message)
    const outcome = signal?.kind === 'invite' && !recorded.has(signal.room) ? outcomes[signal.room] : undefined
    return outcome && outcome.expires === signal?.expires && message.sendID === outcome.caller && message.recvID === outcome.callee
      ? { ...message, textElem: { ...message.textElem, content: encodeSignal(outcome) } }
      : message
  })
}
export function callMessageLabel (message: IMMessage, self: string, tr: Translate) {
  const signal = messageCallSignal(message)
  if (!signal)
    return ''
  switch (signal.kind) {
    case 'invite': return tr('call.title')
    case 'accept': return tr('call.answered')
    case 'cancel': return tr('call.canceledShort')
    case 'reject': return (signal.version === 2 ? signal.callee === self : message.sendID === self) ? tr('call.youRejected') : tr('call.theyRejected')
    case 'busy': return tr('call.peerBusy')
    case 'missed': return tr('call.missed')
    case 'end': return tr('call.title')
    case 'disconnected': return tr('call.interrupted')
  }
}
