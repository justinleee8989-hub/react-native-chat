import type { Session } from '../domain/types'
import type { CallRequest, ServerCall } from './server-controller'
export async function callAuthority (session: Session, url: string, data: CallRequest) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 8000)
  try {
    const response = await fetch(`${url.replace(/\/$/, '')}/user/rtc/call`, { method: 'POST', signal: controller.signal,
      headers: { 'Content-Type': 'application/json', token: session.chatToken || '', operationID: `rtc-${Date.now()}` }, body: JSON.stringify(data) })
    const result = await response.json()
    if (!response.ok || result.errCode !== 0)
      throw new Error(result.errMsg || '通话服务不可用')
    return (result.data?.calls || []) as ServerCall[]
  } finally {
    clearTimeout(timer)
  }
}
