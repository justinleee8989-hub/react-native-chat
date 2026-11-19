import type { Session } from '../../domain/types'

export type ContactLookup = { email: string } | { areaCode: string, phoneNumber: string }

/**
 * The ID of the user whose account has exactly this email or phone number, or undefined when there
 * is none. The chat server answers only for a full match, so this cannot be used to list users.
 */
export async function findUserIDByContact (
  session: Session,
  baseURL: string,
  contact: ContactLookup,
  request: typeof fetch = fetch
): Promise<string | undefined> {
  if (!session.chatToken)
    throw new Error('请重新登录后查找用户')
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000)
  try {
    const response = await request(`${baseURL.replace(/\/$/, '')}/user/find/contact`, {
      method: 'POST', signal: controller.signal,
      headers: { 'Content-Type': 'application/json', token: session.chatToken, operationID: `contact-${Date.now()}` },
      body: JSON.stringify(contact),
    })
    const result = await response.json()
    const user = result?.data?.user
    if (!response.ok || result?.errCode !== 0 || (user != null && typeof user.userID !== 'string'))
      throw new Error(result?.errMsg || '查找用户失败，请重试')
    return user?.userID || undefined
  } finally {
    clearTimeout(timeout)
  }
}
