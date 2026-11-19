import type { Session } from '../../domain/types'
import { ProductError, ServerError } from '../../shared/product-error.ts'

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
    throw new ProductError('lookup.signInFirst')
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
      // A server failure is explained by its code; a reply that is not one is said by us.
      throw result?.errCode ? new ServerError(result, response.status) : new ProductError('lookup.failed')
    return user?.userID || undefined
  } finally {
    clearTimeout(timeout)
  }
}
