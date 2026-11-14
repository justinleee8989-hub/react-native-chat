const INVALID_SESSION_CODES = new Set(['1501', '1502'])

/** OpenIM server codes: TokenExpiredError (1501), TokenInvalidError (1502). */
export function isInvalidSDKLoginError (error: unknown) {
  if (!error || typeof error !== 'object')
    return false
  const value = error as { code?: unknown, errCode?: unknown }
  return INVALID_SESSION_CODES.has(String(value.errCode ?? value.code ?? ''))
}
