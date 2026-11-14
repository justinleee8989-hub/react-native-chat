import md5 from 'md5'
import type { Session } from '../domain/types'

export async function changePassword (session: Session, currentPassword: string, newPassword: string, baseURL: string, request: typeof fetch = fetch): Promise<void> {
  if (!session.chatToken)
    throw new Error('请重新登录后修改密码')
  if (!currentPassword || !newPassword || currentPassword === newPassword)
    throw new Error('请填写当前密码，并使用不同的新密码')
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
      throw new Error('ChatServer 响应格式不正确，请检查服务地址和版本')
    if (!response.ok || result.errCode)
      throw new Error(result.errMsg || `修改密码失败 (${response.status})`)
  } finally {
    clearTimeout(timeout)
  }
}
