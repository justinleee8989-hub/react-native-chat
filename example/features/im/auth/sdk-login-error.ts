/**
 * The OpenIM server's token errors (open-im-server pkg/common/servererrs/code.go): 1501 expired,
 * 1502 invalid, 1503 malformed, 1504 not valid yet, 1505 unknown, 1506 kicked (signed in
 * elsewhere), 1507 not exist (revoked).
 *
 * The token problems mostly arrive as SDK events, which sign out already. This catches the SDK
 * login itself failing with one: any other failure is taken as the network and keeps the user in
 * the app reconnecting, so a dead token must not be read that way, or the app would retry forever.
 * Only these explicit codes count; anything uncertain still keeps the saved login.
 */
const INVALID_SESSION_CODES = new Set(['1501', '1502', '1503', '1504', '1505', '1506', '1507'])

export function isInvalidSDKLoginError (error: unknown) {
  if (!error || typeof error !== 'object')
    return false
  const value = error as { code?: unknown, errCode?: unknown }
  return INVALID_SESSION_CODES.has(String(value.errCode ?? value.code ?? ''))
}
