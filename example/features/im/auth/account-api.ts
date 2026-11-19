import md5 from 'md5'
import { ProductError, ServerError } from '../shared/product-error.ts'

export type AccountMode = 'register' | 'reset'
interface AccountForm {
  mode: AccountMode
  email: string
  password: string
  code: string
  nickname?: string
  invitationCode?: string
}
export function createAccountService (baseURL: string, platform: number, verificationEnabled: boolean, request: typeof fetch = fetch) {
  function check (email: string) {
    if (!verificationEnabled)
      throw new ProductError('auth.emailServiceOff')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      throw new ProductError('auth.enterValidEmail')
  }
  async function post (path: string, body: object) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000)
    try {
      const response = await request(`${baseURL.replace(/\/$/, '')}/account/${path}`, {
        method: 'POST', signal: controller.signal,
        headers: { 'Content-Type': 'application/json', operationID: `account-${Date.now()}` },
        body: JSON.stringify(body),
      })
      const result = await response.json()
      if (!result || typeof result.errCode !== 'number')
        throw new ProductError('error.badResponse')
      if (!response.ok || result.errCode)
        throw new ServerError(result, response.status)
    } finally {
      clearTimeout(timeout)
    }
  }
  return {
    sendCode: async (email: string, mode: AccountMode, invitationCode: string) => {
      check(email)
      await post('code/send', { email, usedFor: mode === 'register' ? 1 : 2, platform, invitationCode })
    },
    submit: async (form: AccountForm) => {
      check(form.email)
      if (!form.password || !form.code.trim() || (form.mode === 'register' && !form.nickname?.trim()))
        throw new ProductError('auth.fillRequired')
      if (form.mode === 'register')
        await post('register', { platform, autoLogin: false, verifyCode: form.code.trim(), invitationCode: form.invitationCode?.trim() || '', user: { email: form.email, nickname: form.nickname?.trim(), password: md5(form.password) } })
      else
        await post('password/reset', { email: form.email, verifyCode: form.code.trim(), password: md5(form.password) })
    },
  }
}
