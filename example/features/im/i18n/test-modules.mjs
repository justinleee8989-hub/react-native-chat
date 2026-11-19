// For node tests that compile one module into a sandbox: its imports of the i18n and error modules
// get the real ones, everything else goes to the test's own `require`.
import * as errorMessage from '../shared/error-message.ts'
import * as productError from '../shared/product-error.ts'
import * as translate from './translate.ts'

export function withI18n (require = () => ({})) {
  return id => /shared\/product-error/.test(id)
    ? productError
    : /shared\/error-message/.test(id)
      ? errorMessage
      : /i18n\/translate/.test(id)
        ? translate
        : require(id)
}

/** The Chinese translator, for checking what a screen would show. */
export const zhT = translate.translatorFor('zh')
