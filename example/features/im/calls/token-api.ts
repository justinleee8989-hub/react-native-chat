import type { Session } from '../domain/types'
export async function requestCallToken (session: Session, room: string, baseURL: string, request: typeof fetch = fetch) {
  if (!session.chatToken)
    throw new Error('请重新登录后使用通话')
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
      throw new Error(result.errMsg || '无法获取通话凭据，请检查本地音视频服务')
    return result.data as { token: string, serverUrl: string }
  } finally {
    clearTimeout(timeout)
  }
}
