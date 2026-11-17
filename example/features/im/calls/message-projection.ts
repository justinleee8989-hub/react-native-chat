import type { IMMessage } from '../domain/types'
import { readReply } from '../messages/composer.ts'
import { parseSignal } from './signaling.ts'

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
export function projectCallMessages (messages: IMMessage[], preservedIDs: string[] = []) {
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
export function callMessageLabel (message: IMMessage, self: string) {
  const signal = messageCallSignal(message)
  if (!signal)
    return ''
  switch (signal.kind) {
    case 'invite': return '音视频通话'
    case 'accept': return '已接听通话'
    case 'cancel': return '已取消'
    case 'reject': return signal.version === 2 ? signal.callee === self ? '已拒接' : '对方已拒接' : message.sendID === self ? '已拒接' : '对方已拒接'
    case 'busy': return '对方正在通话'
    case 'missed': return '未接通话'
    case 'end': return '音视频通话'
    case 'disconnected': return '通话中断'
  }
}
