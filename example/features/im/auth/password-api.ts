import md5 from 'md5'
import type { Session } from '../domain/types'
import { ProductError, ServerError } from '../shared/product-error.ts'

export async function changePassword (session: Session, currentPassword: string, newPassword: string, baseURL: string, request: typeof fetch = fetch): Promise<void> {
  if (!session.chatToken)
    throw new ProductError('auth.signInToChangePassword')
  if (!currentPassword || !newPassword || currentPassword === newPassword)
    throw new ProductError('auth.passwordsMustDiffer')
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000)
  try {
    const response = await request(`${baseURL.replace(/\/$/, '')}/account/password/change`, {
      method: 'POST', signal: controller.signal,
      headers: { 'Content-Type': 'application/json', token: session.chatToken, operationID: `password-${Date.now()}` },
      body: JSON.stringify({ userID: session.userID, currentPassword: md5(currentPassword), newPassword: md5(newPassword) }),
    })
    const result = await response.json()
    if (!result || typeof result.errCode !== 'number')
      throw new ProductError('error.badResponse')
    // PasswordError here means the current password, not a sign-in.
    if (result.errCode === 20001)
      throw new ProductError('password.currentWrong')
    if (!response.ok || result.errCode)
      throw new ServerError(result, response.status)
  } finally {
    clearTimeout(timeout)
  }
}
