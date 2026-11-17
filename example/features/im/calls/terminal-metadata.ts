export interface TerminalMetadata {
  version: 2
  eventID: string
  caller: string
  callee: string
  status: string
  ended: number
  connectedAt?: number
  durationSeconds?: number
}
const kinds: Record<string, string> = { canceled: 'cancel', rejected: 'reject', missed: 'missed', ended: 'end', disconnected: 'disconnected' }
export function terminalMetadata (value: Record<string, unknown>): TerminalMetadata | undefined {
  if (value.version !== 2 || value.eventID !== `rtc-terminal:${value.room}` || typeof value.status !== 'string' || kinds[value.status] !== value.kind || typeof value.caller !== 'string' || !value.caller || typeof value.callee !== 'string' || !value.callee || value.caller === value.callee || !Number.isSafeInteger(value.ended) || Number(value.ended) <= 0)
    return
  if (value.connectedAt !== undefined && (!Number.isSafeInteger(value.connectedAt) || Number(value.connectedAt) <= 0 || Number(value.connectedAt) > Number(value.ended)))
    return
  if (value.durationSeconds !== undefined && (!Number.isSafeInteger(value.durationSeconds) || Number(value.durationSeconds) < 0 || Number(value.durationSeconds) > 0 && value.connectedAt === undefined))
    return
  if (value.connectedAt !== undefined && value.durationSeconds !== undefined && Number(value.durationSeconds) > Math.floor((Number(value.ended) - Number(value.connectedAt)) / 1000))
    return
  return { version: 2, eventID: value.eventID as string, caller: value.caller, callee: value.callee, status: value.status, ended: Number(value.ended), connectedAt: value.connectedAt as number | undefined, durationSeconds: value.durationSeconds as number | undefined }
}
export function formatCallDuration (seconds?: number) {
  if (!Number.isSafeInteger(seconds) || seconds === undefined || seconds < 0)
    return ''
  return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`
}
