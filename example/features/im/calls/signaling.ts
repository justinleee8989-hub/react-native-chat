import type { IMMessage } from '../domain/types'
import { formatCallDuration, terminalMetadata, type TerminalMetadata } from './terminal-metadata.ts'

export type SignalKind = 'invite' | 'accept' | 'reject' | 'busy' | 'cancel' | 'end' | 'missed' | 'disconnected'
export interface CallSignal extends Partial<TerminalMetadata> { room: string, expires: number, kind: SignalKind, name?: string }
export interface ActiveCall extends CallSignal { peer: string, phase: 'incoming' | 'outgoing' | 'accepting' | 'connected' }
interface CallState { active?: ActiveCall, error: string, notice: string }
const prefix = '[OpenIM 呼叫] '
const labels: Record<SignalKind, string> = { invite: '音视频来电', accept: '已接听通话', reject: '已拒接通话', busy: '对方正在通话', cancel: '通话已取消', end: '通话已结束', missed: '未接通话', disconnected: '通话中断' }
export function encodeSignal (signal: CallSignal) {
  return prefix + JSON.stringify(signal)
}
export function parseSignal (text: string): CallSignal | undefined {
  if (!text.startsWith(prefix))
    return
  try {
    const value = JSON.parse(text.slice(prefix.length))
    const metadata = value.version === 2 ? terminalMetadata(value) : undefined
    if (value.version !== undefined && !metadata)
      return
    if (typeof value.room === 'string' && /^imcall-[a-f0-9-]{36}$/.test(value.room) && Number.isSafeInteger(value.expires) && Object.hasOwn(labels, value.kind))
      return { ...metadata, room: value.room, expires: value.expires, kind: value.kind, name: typeof value.name === 'string' ? value.name.slice(0, 80) : undefined }
  } catch { /* Non-protocol text remains an ordinary message. */ }
}
export function signalSummary (text: string) {
  const signal = parseSignal(text)
  return signal ? [labels[signal.kind], signal.connectedAt ? formatCallDuration(signal.durationSeconds) : ''].filter(Boolean).join(' ') : text
}
export function createCallController ({ send, now = Date.now }: { send: (peer: string, signal: CallSignal) => Promise<void>, now?: () => number }) {
  let state: CallState = { error: '', notice: '' }
  let self = ''; let epoch = 0; let reservedRoom = ''
  const seen = new Set<string>()
  const closed = new Set<string>()
  const listeners = new Set<() => void>()
  const update = (patch: Partial<CallState>) => {
    state = { ...state, ...patch }; listeners.forEach(listener => listener())
  }
  const report = (error: unknown) => update({ error: error instanceof Error ? error.message : '通话信令发送失败，请检查连接' })
  const transmit = async (call: ActiveCall, kind: SignalKind) => {
    const generation = epoch
    try {
      await send(call.peer, { room: call.room, expires: call.expires, kind })
    } catch (error) {
      if (generation === epoch)
        report(error)
      throw error
    }
  }
  const finish = async (kind: Exclude<SignalKind, 'invite' | 'accept' | 'busy'>) => {
    const call = state.active
    if (!call)
      return
    update({ active: undefined, notice: labels[kind] })
    await transmit(call, kind)
  }
  return {
    reserveRoom (room: string) {
      if (room && (state.active || (reservedRoom && reservedRoom !== room)))
        throw new Error('已有通话正在进行')
      reservedRoom = room
    },
    releaseRoom (room: string) {
      if (reservedRoom === room)
        reservedRoom = ''
    },
    snapshot: () => state,
    subscribe: (listener: () => void) => {
      listeners.add(listener); return () => {
        listeners.delete(listener)
      }
    },
    reset: (userID: string) => {
      epoch++; self = userID; reservedRoom = ''; seen.clear(); closed.clear(); update({ active: undefined, error: '', notice: '' })
    },
    dismiss: () => update({ notice: '', error: '' }),
    async start (peer: string, name: string, room: string) {
      if (!self || !peer || peer === self)
        throw new Error('请选择另一位联系人发起通话')
      if (state.active || reservedRoom)
        throw new Error('已有通话正在进行')
      const call: ActiveCall = { peer, name, room, expires: now() + 45_000, kind: 'invite', phase: 'outgoing' }
      update({ active: call, error: '', notice: '' })
      try {
        await transmit(call, 'invite')
      } catch (error) {
        if (state.active === call)
          update({ active: undefined })
        throw error
      }
    },
    async accept () {
      const call = state.active
      if (!call || call.phase !== 'incoming')
        return
      if (call.expires <= now()) {
        await finish('missed'); return
      }
      const accepting = { ...call, phase: 'accepting' as const }
      update({ active: accepting })
      try {
        await transmit(call, 'accept')
        if (state.active === accepting)
          update({ active: { ...call, phase: 'connected' } })
      } catch {
        if (state.active === accepting)
          update({ active: { ...call, phase: 'incoming' } })
      }
    },
    finish,
    receive (message: IMMessage) {
      if (!self || message.groupID || message.contentType !== 101 || !message.sendID || message.sendID === self || message.recvID !== self)
        return
      const signal = parseSignal(message.textElem?.content || '')
      if (!signal)
        return
      const roomKey = `${message.sendID}:${signal.room}`
      if (signal.kind !== 'invite' && signal.kind !== 'accept') {
        closed.add(roomKey)
        if (closed.size > 512)
          closed.delete(closed.values().next().value!)
      }
      const key = `${message.sendID}:${signal.room}:${signal.kind}`
      if (seen.has(key))
        return
      seen.add(key)
      if (seen.size > 512)
        seen.delete(seen.values().next().value!)
      const call = state.active
      if (signal.kind === 'invite') {
        if (closed.has(roomKey))
          return
        if (signal.expires <= now() || signal.expires > now() + 60_000)
          return
        if (call || reservedRoom) {
          if (call?.room !== signal.room)
            void transmit({ ...signal, peer: message.sendID, phase: 'incoming' }, 'busy').catch(() => {})
          return
        }
        update({ active: { ...signal, peer: message.sendID, name: message.senderNickname || message.sendID, phase: 'incoming' }, notice: '', error: '' })
        return
      }
      if (!call || call.room !== signal.room || call.peer !== message.sendID || call.expires !== signal.expires)
        return
      if (signal.kind === 'accept') {
        if (call.phase === 'outgoing' && call.expires > now())
          update({ active: { ...call, phase: 'connected' } })
        return
      }
      update({ active: undefined, notice: labels[signal.kind] })
    },
    tick () {
      if (state.active && state.active.phase !== 'connected' && state.active.expires <= now())
        void finish('missed').catch(() => {})
    },
  }
}
