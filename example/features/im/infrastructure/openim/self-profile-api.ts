import type { Session } from '../../domain/types'
import { ProductError, ServerError } from '../../shared/product-error.ts'

export interface SelfProfileIdentity { userID: string, email: string }

export async function fetchSelfProfile (
  session: Session,
  baseURL: string,
  request: typeof fetch = fetch
): Promise<SelfProfileIdentity> {
  if (!session.chatToken)
    throw new ProductError('selfProfile.signInFirst')
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
      // A server failure is explained by its code; a reply that is not one is said by us.
      throw result?.errCode ? new ServerError(result, response.status) : new ProductError('selfProfile.incomplete')
    return { userID: data.userID, email: data.email }
  } finally {
    clearTimeout(timeout)
  }
}
