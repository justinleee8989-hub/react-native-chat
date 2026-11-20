import type { IMMessage } from '../domain/types'
import type { MessageKey } from '../i18n/translate.ts'
import { ProductError } from '../shared/product-error.ts'
import { isCallServiceUnavailable } from './errors.ts'
import { type ActiveCall, type CallSignal, parseSignal, type SignalKind } from './signaling.ts'
import { terminalMetadata } from './terminal-metadata.ts'
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
/**
 * `notice` names what happened to the last call; `error` is a failure, put into words by the screen.
 * `outcomes` are the server's own words on how this user's recent one-to-one calls ended (the
 * record it sends to the chat), by room, as soon as its answer says so: the server sends those
 * records every few seconds, so the chat shows a call's row as ended from here until its record
 * arrives, instead of seconds after hanging up.
 */
interface State { active?: ActiveCall & { groupID?: string, media: MediaPreferences, connectedAt?: number }, error: unknown, notice: MessageKey | '', outcomes: Record<string, CallSignal> }
const outcomeKinds: Record<string, SignalKind> = { canceled: 'cancel', rejected: 'reject', missed: 'missed', ended: 'end', disconnected: 'disconnected' }
const OUTCOMES_KEPT = 20
// How often a call on here is checked with the server when no message has said how it goes: the
// heartbeat that keeps the media's lease while it is connected, otherwise this one call.
const HEARTBEAT_MS = 8000
const CHECK_MS = 10000
// Once the other side is in the media, the server has noted when the call connected (the call
// page's timer counts from it): asked for at once, then after each of these waits while it is not
// there yet. After the last, the heartbeat brings it.
const CONNECT_RETRY_MS = [1000, 2000, 4000]
/** The record the server will send for this ended call, or none while it is not one it sends. */
export function serverOutcome (call: ServerCall): CallSignal | undefined {
  const kind = outcomeKinds[call.status]
  if (!kind || call.groupID || !call.serverRecordDelivery || !call.callee)
    return
  const signal = { version: 2 as const, eventID: `rtc-terminal:${call.room}`, room: call.room, caller: call.caller, callee: call.callee, status: call.status, kind, expires: call.expires, ended: call.ended, connectedAt: call.connectedAt, durationSeconds: call.durationSeconds }
  return terminalMetadata(signal) ? { ...signal, ended: signal.ended! } : undefined
}
export function createServerCallController ({ request, record, now = Date.now }: {
  request: (request: CallRequest) => Promise<ServerCall[]>
  record: (peer: string, signal: CallSignal) => Promise<void>
  now?: () => number
}) {
  let self = ''; let epoch = 0; let revision = 0; let state: State = { error: '', notice: '', outcomes: {} }
  let pending = false; let polling = false; let lastPoll = 0; let lastOK = 0; let mediaRoom = ''
  // Set when the user's calls are to be listed once (sign-in, back in the app, the IM connection
  // back), for a call that rang while no message could arrive. Cleared once a list is answered.
  let listDue = false
  // The call whose connect time is being asked for (peerJoined), how many times so far, and when next.
  let connectRoom = ''; let connectChecks = 0; let nextConnectCheck = 0
  // Set when the server has no call service: polling stops instead of asking every two seconds for
  // as long as the app is open. It starts again on the next sign-in, or when the user's own use of
  // calls (the 通话 page, starting or joining a call) gets an answer.
  let unavailable = false
  const ignored = new Set<string>()
  const listeners = new Set<() => void>()
  // Those waiting for a call's media to connect here (whenMediaReady): told of every change.
  const mediaWaiters = new Set<() => void>()
  const currentCall = () => state.active
  const update = (patch: Partial<State>) => {
    state = { ...state, ...patch }; listeners.forEach(fn => fn()); mediaWaiters.forEach(fn => fn())
  }
  const withOutcome = (call?: ServerCall): Partial<State> => {
    const outcome = call && serverOutcome(call)
    if (!outcome || state.outcomes[outcome.room])
      return {}
    return { outcomes: Object.fromEntries([...Object.entries(state.outcomes).slice(1 - OUTCOMES_KEPT), [outcome.room, outcome]]) }
  }
  /**
   * `listed` is true for the list of all this user's calls, which has those of their other devices
   * too: a one-to-one call there is taken up here only while it rings for this user, so that any of
   * their devices can answer it, or when it is already the one on here. Every other answer is about
   * the one call this device acted on.
   */
  function apply (calls: ServerCall[], listed = false) {
    // Any answer from the authority means the call service is there again.
    unavailable = false
    const previous = state.active
    const existing = calls.find(c => c.room === previous?.room)
    const endedNow = !!existing && !!results[existing.status]
    if (endedNow) {
      ignored.add(existing.room)
      // Still ringing here but ended, not canceled: it was answered and ended within one poll, as
      // when the other side could not connect. Said as such, not as a call that took place.
      const unseen = previous?.phase === 'outgoing' && existing.status === 'ended'
      update({ active: undefined, notice: unseen ? 'call.endedBeforeConnect' : results[existing.status], ...withOutcome(existing) })
    }
    // Dialed or answered on another of this user's devices: that device's call, not this one's.
    const elsewhere = (c: ServerCall) => listed && !c.groupID && c.room !== previous?.room && !(c.status === 'ringing' && c.callee === self)
    const active = calls.find(c => !ignored.has(c.room) && (c.status === 'ringing' || c.status === 'accepted') && (!c.groupID || !!c.members[self]) && !elsewhere(c))
    if (active) {
      const peer = active.caller === self ? active.callee || '' : active.caller
      const same = previous?.room === active.room
      update({ active: { room: active.room, expires: active.expires, kind: 'invite', peer, groupID: active.groupID,
        connectedAt: active.connectedAt,
        media: same ? previous.media : { microphone: true, camera: false, speaker: true },
        name: same ? previous.name : peer,
        phase: active.status === 'accepted' ? 'connected' : active.caller === self ? 'outgoing' : 'incoming' },
      // A new call: what happened to an earlier one is no longer news, and the same ending said again
      // shows again. One that ended in this same answer is still said.
      ...(same || endedNow ? {} : { notice: '' }) })
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
      apply(calls, true)
      listDue = false; lastOK = now()
    } catch (error) {
      failed(error, generation)
    }
    if (generation === epoch)
      polling = false
  }
  /** The fallback for the call on here: its heartbeat, or this one call when there is none to send. */
  async function check () {
    const active = state.active
    if (!self || !active || polling || pending)
      return
    const generation = epoch; const checkRevision = revision
    polling = true
    try {
      const room = active.room
      // A heartbeat answers with the call while it is on; refused, this one call says how it stands.
      let renewed = true
      const calls = active.phase === 'connected' && mediaRoom === room
        ? await request({ action: 'heartbeat', room }).catch(() => {
          renewed = false
          return request({ action: 'get', room })
        })
        : await request({ action: 'get', room })
      if (generation !== epoch || checkRevision !== revision) {
        if (generation === epoch)
          polling = false
        return
      }
      apply(calls)
      // A call still on whose lease was not renewed is not confirmed: past the grace it stops here.
      if (renewed || !state.active)
        lastOK = now()
      else
        failed(undefined, generation)
    } catch (error) {
      failed(error, generation)
    }
    if (generation === epoch)
      polling = false
  }
  /** Asks for the call's connect time when one of those checks is due. */
  function checkConnected () {
    const active = state.active
    if (!active || active.room !== connectRoom || active.connectedAt || connectChecks > CONNECT_RETRY_MS.length ||
      now() < nextConnectCheck || polling || pending)
      return
    nextConnectCheck = now() + (CONNECT_RETRY_MS[connectChecks] ?? 0)
    connectChecks++
    lastPoll = now(); void check()
  }
  function failed (error: unknown, generation: number) {
    if (generation === epoch && isCallServiceUnavailable(error))
      unavailable = true
    if (generation === epoch && state.active && now() - lastOK > 15000) {
      ignored.add(state.active.room)
      update({ active: undefined, error: new ProductError('call.serverUnconfirmed') })
    }
  }
  /** Leaves `call` here at once, saying `notice`, then ends it with the server, whose answer names how it ended. */
  async function leave (call: NonNullable<State['active']>, notice: MessageKey) {
    const generation = epoch; revision++
    ignored.add(call.room)
    update({ active: undefined, notice })
    const action = call.phase === 'connected' ? call.groupID ? 'leave' : 'end' : call.phase === 'incoming' ? 'reject' : 'cancel'
    // A failure here is not said, only thrown: the user has already left on this side, and the
    // server ends a call nobody keeps alive once its lease runs out, so there is nothing to do.
    const calls = await request({ action, room: call.room })
    if (generation === epoch) {
      const result = calls.find(item => item.room === call.room)
      const status = result?.status || ''
      update({ notice: results[status] || 'call.left', ...withOutcome(result) })
      // A drop is the server's to record; any other ending it does not record is recorded from here.
      const kind = status === 'disconnected' ? undefined : outcomeKinds[status]
      if (!call.groupID && !result?.serverRecordDelivery && kind)
        await remember(call, kind, generation)
    }
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
      mediaWaiters.forEach(fn => fn())
    },
    /** The other side is in this call's media here: its connect time is asked for, once per call. */
    peerJoined (room: string) {
      if (connectRoom === room || state.active?.room !== room)
        return
      connectRoom = room; connectChecks = 0; nextConnectCheck = 0
      checkConnected()
    },
    /** Whether this call's media connects here (true) or the call ends here first (false). */
    whenMediaReady (room: string) {
      return new Promise<boolean>(resolve => {
        const settle = () => {
          const active = state.active?.room === room
          if (active && mediaRoom !== room)
            return
          mediaWaiters.delete(settle)
          resolve(active)
        }
        mediaWaiters.add(settle)
        settle()
      })
    },
    snapshot: () => state,
    notifyError: (error: unknown) => update({ error }),
    subscribe: (fn: () => void) => {
      listeners.add(fn); return () => {
        listeners.delete(fn)
      }
    },
    reset (user: string) {
      self = user; mediaRoom = ''; connectRoom = ''; epoch++; pending = false; polling = false; lastPoll = 0; lastOK = now(); listDue = !!user; unavailable = false; ignored.clear(); update({ active: undefined, error: '', notice: '', outcomes: {} })
    },
    dismiss: () => update({ error: '', notice: '' }),
    /** The call service answered a request made outside the controller (the 通话 page's list). */
    serviceAnswered () {
      unavailable = false
    },
    /** Lists the user's calls on the next tick: back in the app, or the IM connection back. */
    recheck () {
      if (self && !state.active) {
        listDue = true; lastPoll = 0
      }
    },
    /**
     * A one-to-one call's messages move the call on here at once; the server is asked only as a
     * fallback (tick). Only the two people in the call can write to their chat, and the record
     * of how it ended counts only as sent by its caller, which the server sends it as: one that
     * is not true can do no more than either of them hanging up, and is ended with the server too.
     */
    receive (message: unknown) {
      const item = message as IMMessage
      if (!self || item.groupID || item.contentType !== 101 || !item.sendID || !item.recvID)
        return
      const signal = parseSignal(item.textElem?.content || '')
      const call = state.active
      if (!signal)
        return
      if (signal.kind === 'invite') {
        // From the caller, still ringing, and not already over here; one from this user is theirs on another device.
        if (item.recvID !== self || item.sendID === self || call || pending || ignored.has(signal.room) ||
          signal.expires <= now() || signal.expires > now() + 60_000)
          return
        revision++; lastOK = now(); lastPoll = now()
        update({ active: { room: signal.room, expires: signal.expires, kind: 'invite', peer: item.sendID, name: item.senderNickname || item.sendID,
          media: { microphone: true, camera: false, speaker: true }, phase: 'incoming' }, error: '', notice: '' })
        // Rung at once, then checked with the server: an invitation read late may be for a call already over.
        void check()
        return
      }
      if (!call || call.groupID || call.room !== signal.room || call.expires !== signal.expires)
        return
      const fromPeer = item.sendID === call.peer && item.recvID === self
      const fromSelf = item.sendID === self && item.recvID === call.peer
      if (signal.kind === 'accept') {
        if (fromPeer && call.phase === 'outgoing') {
          revision++
          update({ active: { ...call, phase: 'connected' } })
        } else if (fromSelf && call.phase === 'incoming' && !pending) {
          // Answered on another of this user's devices: this one stops ringing, saying nothing.
          revision++; ignored.add(call.room)
          update({ active: undefined, notice: '' })
        }
        return
      }
      if (signal.version === 2 && (fromPeer || fromSelf) && item.sendID === signal.caller && item.recvID === signal.callee)
        void leave(call, results[signal.status || ''] || 'call.ended').catch(() => {})
    },
    tick () {
      if (unavailable || !self)
        return
      checkConnected()
      const active = state.active
      const every = !active ? CHECK_MS : active.phase === 'connected' && mediaRoom === active.room ? HEARTBEAT_MS : CHECK_MS
      if ((active || listDue) && now() - lastPoll > every) {
        lastPoll = now(); void (active ? check() : poll())
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
    /** Ends the call on here: cancels, rejects, ends or leaves it, as its phase calls for. */
    async finish () {
      const call = state.active
      if (call)
        await leave(call, 'call.ended')
    },
  }
}
