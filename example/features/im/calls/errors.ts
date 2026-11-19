import { isProductError, ProductError } from '../shared/product-error.ts'

/** The chat server runs without a call service (no RTC authority configured). */
export class CallServiceUnavailableError extends ProductError {
  constructor () {
    super('call.serviceDisabled')
    this.name = 'CallServiceUnavailableError'
  }
}

export function isCallServiceUnavailable (error: unknown) {
  return (error as { name?: string })?.name === 'CallServiceUnavailableError'
}

/** A failure from the media devices said as what the user can do; others pass on unchanged. */
export function callError (error: unknown): unknown {
  const value = error as { name?: string, message?: string, errCode?: unknown }
  if (value?.name === 'NotFoundError' || value?.message?.includes('Requested device not found'))
    return new ProductError('call.noDevice')
  if (value?.name === 'NotAllowedError')
    return new ProductError('call.devicePermission')
  if (value?.name === 'NotReadableError')
    return new ProductError('call.deviceBusy')
  return isProductError(error) || value?.errCode ? error : new ProductError('call.failed')
}
