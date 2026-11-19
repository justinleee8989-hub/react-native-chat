import type { MessageKey } from '../i18n/translate.ts'
import { ProductError } from '../shared/product-error.ts'
import { isCallServiceUnavailable } from './errors.ts'
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
const results: Record<string, MessageKey> = { ended: 'call.ended', canceled: 'call.canceled', rejected: 'call.rejected', missed: 'call.missed', disconnected: 'call.droppedEnded' }
export interface MediaPreferences { microphone: boolean, camera: boolean, speaker: boolean }
/** `notice` names what happened to the last call; `error` is a failure, put into words by the screen. */
interface State { active?: ActiveCall & { groupID?: string, media: MediaPreferences, connectedAt?: number }, error: unknown, notice: MessageKey | '' }
export function createServerCallController ({ request, record, now = Date.now }: {
  request: (request: CallRequest) => Promise<ServerCall[]>
  record: (peer: string, signal: CallSignal) => Promise<void>
  now?: () => number
}) {
  let self = ''; let epoch = 0; let revision = 0; let state: State = { error: '', notice: '' }
  let pending = false; let polling = false; let lastPoll = 0; let lastOK = 0; let lastBeat = 0; let mediaRoom = ''
  // Set when the server has no call service: polling stops instead of asking every two seconds for
  // as long as the app is open. It starts again on the next sign-in, or when the user's own use of
  // calls (the 通话 page, starting or joining a call) gets an answer.
  let unavailable = false
  const ignored = new Set<string>()
  const listeners = new Set<() => void>()
  const currentCall = () => state.active
  const update = (patch: Partial<State>) => {
    state = { ...state, ...patch }; listeners.forEach(fn => fn())
  }
  function apply (calls: ServerCall[]) {
    // Any answer from the authority means the call service is there again.
    unavailable = false
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
        name: previous?.room === active.room ? previous.name : peer,
        phase: active.status === 'accepted' ? 'connected' : active.caller === self ? 'outgoing' : 'incoming' } })
    } else if (previous && !results[existing?.status || '']) {
      update({ active: undefined, notice: 'call.ended' })
    }
  }
  async function remember (call: ActiveCall, kind: SignalKind, generation: number) {
    if (!call.peer || generation !== epoch)
      return
    try {
      await record(call.peer, { room: call.room, expires: call.expires, kind })
    } catch {
      if (generation === epoch)
        update({ error: new ProductError('call.recordFailed') })
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
    } catch (error) {
      if (generation === epoch && isCallServiceUnavailable(error))
        unavailable = true
      if (generation === epoch && state.active && now() - lastOK > 15000) {
        ignored.add(state.active.room)
        update({ active: undefined, error: new ProductError('call.serverUnconfirmed') })
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
    notifyError: (error: unknown) => update({ error }),
    subscribe: (fn: () => void) => {
      listeners.add(fn); return () => {
        listeners.delete(fn)
      }
    },
    reset (user: string) {
      self = user; mediaRoom = ''; epoch++; pending = false; polling = false; lastPoll = 0; lastOK = now(); lastBeat = 0; unavailable = false; ignored.clear(); update({ active: undefined, error: '', notice: '' })
    },
    dismiss: () => update({ error: '', notice: '' }),
    /** The call service answered a request made outside the controller (the 通话 page's list). */
    serviceAnswered () {
      unavailable = false
    },
    // OpenIM messages are durable display records, never authoritative call transitions.
    receive (message: unknown) {
      void message
    },
    tick () {
      if (!unavailable && now() - lastPoll > 2000) {
        lastPoll = now(); void poll()
      }
    },
    poll,
    async start (peer: string, name: string, requestID: string) {
      if (pending || state.active)
        throw new ProductError('call.alreadyActive')
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
        throw new ProductError('call.alreadyActive')
      const generation = epoch; revision++; pending = true
      try {
        const calls = await request({ action: 'create', groupID, requestID })
        if (generation !== epoch)
          throw new ProductError('session.changed')
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
      update({ active: undefined, notice: 'call.ended' })
      const action = call.phase === 'connected' ? call.groupID ? 'leave' : 'end' : call.phase === 'incoming' ? 'reject' : 'cancel'
      try {
        const calls = await request({ action, room: call.room })
        if (generation === epoch) {
          const result = calls.find(item => item.room === call.room)
          const status = result?.status || ''
          update({ notice: results[status] || 'call.left' })
          const terminalKinds: Record<string, SignalKind> = { canceled: 'cancel', rejected: 'reject', missed: 'missed', ended: 'end' }
          if (!call.groupID && !result?.serverRecordDelivery && terminalKinds[status])
            await remember(call, terminalKinds[status], generation)
        }
      } catch (error) {
        if (generation === epoch)
          update({ error: new ProductError('call.leaveUnconfirmed') })
        throw error
      }
    },
  }
}
