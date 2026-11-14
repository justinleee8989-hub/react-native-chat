export interface CallInvitation { room: string, expires: number }
const prefix = '[OpenIM 通话邀请] '
export function parseCallInvitation (text: string): CallInvitation | undefined {
  if (!text.startsWith(prefix))
    return
  try {
    const value = JSON.parse(text.slice(prefix.length))
    if (/^imcall-[a-f0-9-]{36}$/.test(value.room) && Number.isFinite(value.expires))
      return { room: value.room, expires: value.expires }
  } catch { /* Ordinary messages are not call invitations. */ }
}
export function formatCallInvitation (value: CallInvitation) {
  return prefix + JSON.stringify(value)
}
export function assertActiveInvitation (value: CallInvitation, now = Date.now()) {
  if (!parseCallInvitation(formatCallInvitation(value)) || value.expires <= now)
    throw new Error('通话邀请已过期或无效，请重新发起')
}

export function assertJoinableInvitation (call?: { status: string, expires: number }) {
  if (!call || call.status !== 'accepted')
    throw new Error('通话已结束，请重新发起通话，不要重发旧邀请')
  if (call.expires <= Date.now())
    throw new Error('通话邀请已过期，请重新发起通话')
}
