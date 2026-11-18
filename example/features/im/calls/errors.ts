/** The chat server runs without a call service (no RTC authority configured). */
export class CallServiceUnavailableError extends Error {
  constructor () {
    super('通话服务未启用，暂时无法使用音视频通话')
    this.name = 'CallServiceUnavailableError'
  }
}

export function isCallServiceUnavailable (error: unknown) {
  return (error as { name?: string })?.name === 'CallServiceUnavailableError'
}

export function callError (error: unknown): Error {
  const value = error as { name?: string, message?: string }
  if (value?.name === 'NotFoundError' || value?.message?.includes('Requested device not found'))
    return new Error('未检测到可用的麦克风或摄像头，请连接设备后重试')
  if (value?.name === 'NotAllowedError')
    return new Error('未获得麦克风或摄像头权限，请在浏览器或系统设置中允许后重试')
  if (value?.name === 'NotReadableError')
    return new Error('媒体设备被占用或无法读取，请关闭其他占用设备的应用后重试')
  return new Error(value?.message || '通话操作失败，请重试')
}

export function safeCallErrorMessage (error: unknown, fallback = '请检查连接后重试') {
  const value = error as { message?: string, errMsg?: string }
  const message = (value?.errMsg || value?.message || fallback)
    .replace(/\b[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{8,}\b/g, '[凭据已隐藏]')
    .replace(/\bBearer\s+\S+/gi, 'Bearer [凭据已隐藏]')
    .replace(/\b(token|authorization)\s*[:=]\s*[^\s,;]+/gi, '$1=[凭据已隐藏]')
  if (message === 'NoPermissionError')
    return '通话已不可用或无权加入'
  return message.slice(0, 200)
}
