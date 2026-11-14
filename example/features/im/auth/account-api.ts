import md5 from 'md5'

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
      throw new Error('尚未配置邮件验证服务，请联系管理员启用后再试')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      throw new Error('请填写有效邮箱')
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
        throw new Error('ChatServer 响应格式不正确，请检查服务地址和版本')
      if (!response.ok || result.errCode)
        throw new Error(result.errMsg || `账户操作失败 (${response.status})`)
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
        throw new Error('请填写密码、验证码及昵称（注册时）')
      if (form.mode === 'register')
        await post('register', { platform, autoLogin: false, verifyCode: form.code.trim(), invitationCode: form.invitationCode?.trim() || '', user: { email: form.email, nickname: form.nickname?.trim(), password: md5(form.password) } })
      else
        await post('password/reset', { email: form.email, verifyCode: form.code.trim(), password: md5(form.password) })
    },
  }
}
