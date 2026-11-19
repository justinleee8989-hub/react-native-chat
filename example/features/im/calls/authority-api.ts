import type { Session } from '../domain/types'
import { ProductError, ServerError } from '../shared/product-error.ts'
import { CallServiceUnavailableError } from './errors.ts'
import type { CallRequest, ServerCall } from './server-controller'
export async function callAuthority (session: Session, url: string, data: CallRequest) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 8000)
  try {
    const response = await fetch(`${url.replace(/\/$/, '')}/user/rtc/call`, { method: 'POST', signal: controller.signal,
      headers: { 'Content-Type': 'application/json', token: session.chatToken || '', operationID: `rtc-${Date.now()}` }, body: JSON.stringify(data) })
    const result = await response.json()
    // FeatureDisabled: the server has no call service, which callers tell apart from a retryable failure.
    if (result.errCode === 20201)
      throw new CallServiceUnavailableError()
    if (!response.ok || result.errCode !== 0)
      throw result?.errCode ? new ServerError(result, response.status) : new ProductError('call.unavailable')
    return (result.data?.calls || []) as ServerCall[]
  } finally {
    clearTimeout(timer)
  }
}
