import md5 from 'md5'
import type { Session } from '../domain/types'
import { ProductError, ServerError } from '../shared/product-error.ts'

/** ChatServer owns authentication; IM tokens must only be used by the IM SDK. */
export async function authenticate (
  account: string,
  password: string,
  baseURL: string,
  platform: number,
  request: typeof fetch = fetch
): Promise<Session> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000)
  try {
    const response = await request(`${baseURL.replace(/\/$/, '')}/account/login`, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', operationID: `login-${Date.now()}` },
      body: JSON.stringify({
        account,
        email: account.includes('@') ? account : '',
        password: md5(password),
        platform,
        deviceID: '',
        verifyCode: '',
        areaCode: '',
        phoneNumber: '',
      }),
    })
    const result = await response.json()
    // 20001 (wrong account or password) and the rest are explained by their code.
    if (!response.ok || result.errCode)
      throw new ServerError(result, response.status)
    const data = result.data
    if (
      !data ||
      !['userID', 'imToken', 'chatToken'].every(
        key => typeof data[key] === 'string' && data[key].length > 0
      )
    )
      throw new ProductError('auth.badLoginResponse')
    return { userID: data.userID, imToken: data.imToken, chatToken: data.chatToken }
  } finally {
    clearTimeout(timeout)
  }
}
