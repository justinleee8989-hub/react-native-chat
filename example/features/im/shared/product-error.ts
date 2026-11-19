import { type MessageKey, type Params, translate } from '../i18n/translate.ts'

/**
 * A failure the app explains itself: it carries the text's key, and the screen that shows it puts
 * it in the current language. The message is the Chinese text, for logs and tests only.
 */
export class ProductError extends Error {
  readonly key: MessageKey
  readonly params?: Params
  constructor (key: MessageKey, params?: Params) {
    super(translate('zh', key, params))
    this.name = 'ProductError'
    this.key = key
    this.params = params
  }
}

export function isProductError (value: unknown): value is ProductError {
  return value instanceof ProductError || (value as { name?: unknown })?.name === 'ProductError' && typeof (value as { key?: unknown }).key === 'string'
}

/**
 * An error the chat server answered (`errCode` other than 0). The screen explains it by its code;
 * `errMsg` and `errDlt` are kept for logs, never shown.
 */
export class ServerError extends Error {
  readonly errCode: number
  readonly errDlt: string
  constructor (result: { errCode?: unknown, errMsg?: unknown, errDlt?: unknown }, status?: number) {
    super(typeof result?.errMsg === 'string' && result.errMsg ? result.errMsg : `HTTP ${status ?? 0}`)
    this.name = 'ServerError'
    this.errCode = Number(result?.errCode) || 0
    this.errDlt = typeof result?.errDlt === 'string' ? result.errDlt : ''
  }
}
