import type { Session } from '../domain/types'
import { ProductError, ServerError } from '../shared/product-error.ts'
export async function requestCallToken (session: Session, room: string, baseURL: string, request: typeof fetch = fetch) {
  if (!session.chatToken)
    throw new ProductError('call.signInFirst')
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000)
  try {
    const response = await request(`${baseURL.replace(/\/$/, '')}/user/rtc/get_token`, {
      method: 'POST', signal: controller.signal,
      headers: { 'Content-Type': 'application/json', token: session.chatToken, operationID: `call-${Date.now()}` },
      body: JSON.stringify({ room, identity: session.userID }),
    })
    const result = await response.json()
    if (!response.ok || result.errCode !== 0 || !result.data?.token || !result.data?.serverUrl)
      throw result?.errCode ? new ServerError(result, response.status) : new ProductError('call.noToken')
    return result.data as { token: string, serverUrl: string }
  } finally {
    clearTimeout(timeout)
  }
}
