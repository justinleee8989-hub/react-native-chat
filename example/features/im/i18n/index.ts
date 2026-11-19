import { getLocales, useLocales } from 'expo-localization'
import { useLanguageChoice } from '../ui/preferences'
import { type Language, localeOf, resolveLanguage, translatorFor } from './translate'

export { isMessageKey, languageNames, localeOf, translate, translatorFor } from './translate'
export type { Language, LanguageChoice, MessageKey, Params, Translate } from './translate'

/** The language the screens show now: the user's pick in 我的 → 语言, else the system's. */
export function useLanguage (): Language {
  const choice = useLanguageChoice()
  const locales = useLocales()
  return resolveLanguage(choice, locales.map(locale => locale.languageTag))
}

/** `t` for the current language; a new function only when the language changes. */
export function useT () {
  return translatorFor(useLanguage())
}

/** The current language's tag for dates and the chat library, e.g. `zh-CN`. */
export function useLocaleTag () {
  return localeOf(useLanguage())
}

/** The system's language, for code that runs outside a screen and has no user pick to hand. */
export function systemLanguage (): Language {
  return resolveLanguage('auto', getLocales().map(locale => locale.languageTag))
}
