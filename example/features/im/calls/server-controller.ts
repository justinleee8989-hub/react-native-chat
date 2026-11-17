import { safeCallErrorMessage } from './errors.ts'
import type { ActiveCall, CallSignal, SignalKind } from './signaling'
export interface ServerCall {
  room: string
  caller: string
  callee?: string
  groupID?: string
  status: string
  created: number
  expires: number
  ended?: number
  connectedAt?: number
  durationSeconds?: number
  serverRecordDelivery?: boolean
  members: Record<string, { lease: number }>
}
export interface CallRequest { action: string, room?: string, peer?: string, groupID?: string, requestID?: string }
const results: Record<string, string> = { ended: '通话已结束', canceled: '通话已取消', rejected: '已拒接通话', missed: '未接通话', disconnected: '连接中断，通话已结束' }
export interface MediaPreferences { microphone: boolean, camera: boolean, speaker: boolean }
interface State { active?: ActiveCall & { groupID?: string, media: MediaPreferences, connectedAt?: number }, error: string, notice: string }
export function createServerCallController ({ request, record, now = Date.now }: {
  request: (request: CallRequest) => Promise<ServerCall[]>
  record: (peer: string, signal: CallSignal) => Promise<void>
  now?: () => number
}) {
  let self = ''; let epoch = 0; let revision = 0; let state: State = { error: '', notice: '' }
  let pending = false; let polling = false; let lastPoll = 0; let lastOK = 0; let lastBeat = 0; let mediaRoom = ''
  const ignored = new Set<string>()
  const listeners = new Set<() => void>()
  const currentCall = () => state.active
  const update = (patch: Partial<State>) => {
    state = { ...state, ...patch }; listeners.forEach(fn => fn())
  }
  function apply (calls: ServerCall[]) {
    const previous = state.active
    const existing = calls.find(c => c.room === previous?.room)
    if (existing && results[existing.status]) {
      ignored.add(existing.room)
      update({ active: undefined, notice: results[existing.status] })
    }
    const active = calls.find(c => !ignored.has(c.room) && (c.status === 'ringing' || c.status === 'accepted') && (!c.groupID || !!c.members[self]))
    if (active) {
      const peer = active.caller === self ? active.callee || '' : active.caller
      update({ active: { room: active.room, expires: active.expires, kind: 'invite', peer, groupID: active.groupID,
        connectedAt: active.connectedAt,
        media: previous?.room === active.room ? previous.media : { microphone: true, camera: false, speaker: true },
        name: previous?.room === active.room ? previous.name : peer || '群通话',
        phase: active.status === 'accepted' ? 'connected' : active.caller === self ? 'outgoing' : 'incoming' } })
    } else if (previous && !results[existing?.status || '']) {
      update({ active: undefined, notice: '通话已结束' })
    }
  }
  async function remember (call: ActiveCall, kind: SignalKind, generation: number) {
    if (!call.peer || generation !== epoch)
      return
    try {
      await record(call.peer, { room: call.room, expires: call.expires, kind })
    } catch (error) {
      if (generation === epoch)
        update({ error: `通话状态已保存，聊天记录发送失败：${safeCallErrorMessage(error, '请检查 IM 连接')}` })
    }
  }
  async function poll () {
    if (!self || polling || pending)
      return
    const generation = epoch; const pollRevision = revision
    polling = true
    try {
      const calls = await request({ action: 'list' })
      if (generation !== epoch || pollRevision !== revision) {
        if (generation === epoch)
          polling = false
        return
      }
      apply(calls)
      const active = state.active
      const heartbeat = active?.phase === 'connected' && mediaRoom === active.room && now() - lastBeat > 8000
      if (heartbeat) {
        await request({ action: 'heartbeat', room: active.room })
        if (generation === epoch)
          lastBeat = now()
      }
      if (generation === epoch)
        lastOK = now()
    } catch {
      if (generation === epoch && state.active && now() - lastOK > 15000) {
        ignored.add(state.active.room)
        update({ active: undefined, error: '无法确认服务端通话状态，已断开本地通话，请检查网络后重新发起' })
      }
    }
    if (generation === epoch)
      polling = false
  }
  return {
    setMediaPreference (room: string, key: keyof MediaPreferences, enabled: boolean) {
      const active = state.active
      if (active?.room === room)
        update({ active: { ...active, media: { ...active.media, [key]: enabled } } })
    },
    mediaReady (room: string, ready: boolean) {
      if (ready)
        mediaRoom = room
      else if (mediaRoom === room)
        mediaRoom = ''
    },
    snapshot: () => state,
    notifyError: (error: string) => update({ error }),
    subscribe: (fn: () => void) => {
      listeners.add(fn); return () => {
        listeners.delete(fn)
      }
    },
    reset (user: string) {
      self = user; mediaRoom = ''; epoch++; pending = false; polling = false; lastPoll = 0; lastOK = now(); lastBeat = 0; ignored.clear(); update({ active: undefined, error: '', notice: '' })
    },
    dismiss: () => update({ error: '', notice: '' }),
    // OpenIM messages are durable display records, never authoritative call transitions.
    receive (message: unknown) {
      void message
    },
    tick () {
      if (now() - lastPoll > 2000) {
        lastPoll = now(); void poll()
      }
    },
    poll,
    async start (peer: string, name: string, requestID: string) {
      if (pending || state.active)
        throw new Error('已有通话正在进行')
      const generation = epoch; revision++; pending = true
      try {
        const calls = await request({ action: 'create', peer, requestID: requestID.replace(/^imcall-/, '') })
        if (generation !== epoch)
          return
        lastOK = now(); apply(calls)
        const active = currentCall()
        if (active) {
          update({ active: { ...active, name }, error: '', notice: '' }); await remember(active, 'invite', generation)
        }
      } finally {
        if (generation === epoch)
          pending = false
      }
    },
    async group (groupID: string, requestID: string) {
      if (pending || state.active)
        throw new Error('已有通话正在进行')
      const generation = epoch; revision++; pending = true
      try {
        const calls = await request({ action: 'create', groupID, requestID })
        if (generation !== epoch)
          throw new Error('登录已改变')
        lastOK = now(); apply(calls); return calls[0]
      } finally {
        if (generation === epoch)
          pending = false
      }
    },
    async join (room: string) {
      if (state.active || pending)
        return
      const generation = epoch; revision++; pending = true
      try {
        const calls = await request({ action: 'join', room })
        if (generation === epoch) {
          lastOK = now()
          ignored.delete(room)
          apply(calls)
        }
      } finally {
        if (generation === epoch)
          pending = false
      }
    },
    async accept () {
      const call = state.active
      if (!call || call.phase !== 'incoming' || pending)
        return
      const generation = epoch; revision++; pending = true
      try {
        const calls = await request({ action: 'accept', room: call.room })
        if (generation === epoch && !ignored.has(call.room)) {
          lastOK = now(); apply(calls); await remember(call, 'accept', generation)
        }
      } finally {
        if (generation === epoch)
          pending = false
      }
    },
    async finish (kind: Exclude<SignalKind, 'invite' | 'accept' | 'busy'>) {
      // Keep the caller API compatible; only the authority response decides the record.
      void kind
      const call = state.active
      if (!call)
        return
      const generation = epoch; revision++
      ignored.add(call.room)
      update({ active: undefined, notice: '通话已结束' })
      const action = call.phase === 'connected' ? call.groupID ? 'leave' : 'end' : call.phase === 'incoming' ? 'reject' : 'cancel'
      try {
        const calls = await request({ action, room: call.room })
        if (generation === epoch) {
          const result = calls.find(item => item.room === call.room)
          const status = result?.status || ''
          update({ notice: results[status] || '已离开通话' })
          const terminalKinds: Record<string, SignalKind> = { canceled: 'cancel', rejected: 'reject', missed: 'missed', ended: 'end' }
          if (!call.groupID && !result?.serverRecordDelivery && terminalKinds[status])
            await remember(call, terminalKinds[status], generation)
        }
      } catch (error) {
        if (generation === epoch)
          update({ error: '本地已断开，服务端确认失败，将由断线超时回收' })
        throw error
      }
    },
  }
}
