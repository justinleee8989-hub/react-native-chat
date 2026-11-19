import { en } from './en.ts'
import { zh } from './zh.ts'

/** The languages the app is written in. Chinese is the reference: every key is defined there first. */
export type Language = 'zh' | 'en'
/** Each language named in itself, as language pickers do, so a user finds theirs whatever is shown. */
export const languageNames: Record<Language, string> = { zh: '简体中文', en: 'English' }
/** What the user picked in 我的 → 语言: a language, or whatever the system uses. */
export type LanguageChoice = 'auto' | Language
export type Params = Record<string, string | number>
/** A text, or for wording that changes with a number (English plurals) a function of the params. */
export type Entry = string | ((params: Params) => string)
export type MessageKey = keyof typeof zh
/** Puts a key into the current language; it also says which language, and its tag for dates. */
export type Translate = ((key: MessageKey, params?: Params) => string) & { language: Language, locale: string }

const dictionaries: Record<Language, Record<MessageKey, Entry>> = { zh, en }

export function parseLanguageChoice (value: string | null): LanguageChoice {
  return value === 'zh' || value === 'en' ? value : 'auto'
}

/** The language to show: the user's pick, else the first system language the app has, else Chinese. */
export function resolveLanguage (choice: LanguageChoice, systemTags: readonly string[]): Language {
  if (choice !== 'auto')
    return choice
  for (const tag of systemTags) {
    const base = tag.split(/[-_]/)[0]?.toLowerCase()
    if (base === 'zh' || base === 'en')
      return base
  }
  return 'zh'
}

/** The BCP-47 tag for dates, numbers and the chat library. */
export function localeOf (language: Language) {
  return language === 'zh' ? 'zh-CN' : 'en-US'
}

export function isMessageKey (key: string): key is MessageKey {
  return Object.prototype.hasOwnProperty.call(zh, key)
}

/** `{name}` in a text is replaced by `params.name`; a placeholder with no param is left as it is. */
export function translate (language: Language, key: MessageKey, params: Params = {}): string {
  const entry = dictionaries[language][key] ?? zh[key]
  // A key missing from the tables (a value from outside, typed as a key) shows as itself, never breaks a screen.
  if (entry === undefined)
    return String(key)
  const text = typeof entry === 'function' ? entry(params) : entry
  return text.replace(/\{(\w+)\}/g, (whole, name: string) => name in params ? String(params[name]) : whole)
}

const translators = new Map<Language, Translate>()
/** One function per language, so a component memoised on `t` recomputes exactly when the language changes. */
export function translatorFor (language: Language): Translate {
  let t = translators.get(language)
  if (!t) {
    t = Object.assign((key: MessageKey, params?: Params) => translate(language, key, params), { language, locale: localeOf(language) })
    translators.set(language, t)
  }
  return t
}
