import { ProductError } from '../shared/product-error.ts'
export interface CallInvitation { room: string, expires: number }
// Wire format other clients match: never shown, never translated.
const prefix = '[OpenIM 通话邀请] ' // i18n-ignore
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
    throw new ProductError('call.invitationExpired')
}

export function assertJoinableInvitation (call?: { status: string, expires: number }) {
  if (!call || call.status !== 'accepted')
    throw new ProductError('call.endedDontResend')
  if (call.expires <= Date.now())
    throw new ProductError('call.invitationTimedOut')
}
