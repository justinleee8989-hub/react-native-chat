import { isMessageKey, type MessageKey, type Translate } from '../i18n/translate.ts'
import { isProductError } from './product-error.ts'

/**
 * What the user is told about a failure, in the current language. The app's own failures say their
 * text by key; a server failure is explained by its error code (the chat server and the OpenIM SDK
 * both answer one). Server or SDK wording is never shown: it is not a UI contract, and may carry
 * diagnostics (paths, stacks or credentials). Anything else reads as the generic failure.
 */
export function errorMessage (reason: unknown, tr: Translate): string {
  if (!reason)
    return ''
  // Several warnings at once (a restore and an unavailable service on connect): each is said.
  if (Array.isArray(reason))
    return reason.map(item => errorMessage(item, tr)).filter(Boolean).join(' ')
  if (isProductError(reason))
    return tr(reason.key, reason.params)
  const value = reason as { errCode?: unknown, code?: unknown, errMsg?: unknown, message?: unknown, name?: unknown }
  const code = String(value?.errCode ?? value?.code ?? '')
  const known = `serverError.${code}`
  if (code && isMessageKey(known))
    return tr(known)
  const raw = typeof value?.errMsg === 'string' ? value.errMsg : typeof value?.message === 'string' ? value.message : typeof reason === 'string' ? reason : ''
  if (/user\s*(?:id)?\s*(?:not found|does not exist|not exist)/i.test(raw))
    return tr('error.userNotFound')
  if (/group\s*(?:id)?\s*(?:not found|does not exist|not exist)/i.test(raw))
    return tr('error.groupNotFound')
  if (/permission denied|no permission|not (?:a )?group member|not in (?:the )?group/i.test(raw))
    return tr('error.noPermission')
  if (value?.name === 'AbortError' || /timeout|timed out|failed to fetch|network request failed/i.test(raw))
    return tr('error.network')
  return tr('error.generic')
}

/**
 * A failure as the key of its text, for a failure that is saved (an attachment batch kept across
 * restarts): the app's own key, the server code's, or the generic failure.
 */
export function errorKey (reason: unknown): MessageKey {
  if (isProductError(reason))
    return reason.key
  const value = reason as { errCode?: unknown, code?: unknown }
  const known = `serverError.${String(value?.errCode ?? value?.code ?? '')}`
  return isMessageKey(known) ? known : 'error.generic'
}
