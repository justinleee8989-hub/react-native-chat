import type { Session } from '../../domain/types'

export interface SelfProfileIdentity { userID: string, email: string }

export async function fetchSelfProfile (
  session: Session,
  baseURL: string,
  request: typeof fetch = fetch
): Promise<SelfProfileIdentity> {
  if (!session.chatToken)
    throw new Error('请重新登录后读取个人资料')
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000)
  try {
    const response = await request(`${baseURL.replace(/\/$/, '')}/user/self`, {
      method: 'POST', signal: controller.signal,
      headers: { 'Content-Type': 'application/json', token: session.chatToken, operationID: `profile-${Date.now()}` },
      body: JSON.stringify({}),
    })
    const result = await response.json()
    const data = result?.data
    if (!response.ok || result?.errCode !== 0 || data?.userID !== session.userID || typeof data?.email !== 'string')
      throw new Error(result?.errMsg || '个人资料响应不完整，请重试')
    return { userID: data.userID, email: data.email }
  } finally {
    clearTimeout(timeout)
  }
}
