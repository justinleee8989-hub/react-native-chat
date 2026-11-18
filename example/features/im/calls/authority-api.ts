import type { Session } from '../domain/types'
import { CallServiceUnavailableError } from './errors.ts'
import type { CallRequest, ServerCall } from './server-controller'
export async function callAuthority (session: Session, url: string, data: CallRequest) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 8000)
  try {
    const response = await fetch(`${url.replace(/\/$/, '')}/user/rtc/call`, { method: 'POST', signal: controller.signal,
      headers: { 'Content-Type': 'application/json', token: session.chatToken || '', operationID: `rtc-${Date.now()}` }, body: JSON.stringify(data) })
    const result = await response.json()
    // The server answers a generic NoPermissionError and names the cause only in the detail; shown
    // as is it read 操作失败, and callers could not tell it apart from a retryable failure.
    if (result.errCode !== 0 && /通话服务未启用/.test(`${result.errMsg} ${result.errDlt}`))
      throw new CallServiceUnavailableError()
    if (!response.ok || result.errCode !== 0)
      throw new Error(result.errMsg || '通话服务不可用')
    return (result.data?.calls || []) as ServerCall[]
  } finally {
    clearTimeout(timer)
  }
}
