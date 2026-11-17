import md5 from 'md5'
import type { Session } from '../domain/types'

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
    if (result.errCode === 20001)
      throw new Error('账号或密码错误')
    if (!response.ok || result.errCode)
      throw new Error(result.errMsg || `登录失败 (${response.status})`)
    const data = result.data
    if (
      !data ||
      !['userID', 'imToken', 'chatToken'].every(
        key => typeof data[key] === 'string' && data[key].length > 0
      )
    )
      throw new Error('登录响应不完整，请检查 ChatServer 版本')
    return { userID: data.userID, imToken: data.imToken, chatToken: data.chatToken }
  } finally {
    clearTimeout(timeout)
  }
}
