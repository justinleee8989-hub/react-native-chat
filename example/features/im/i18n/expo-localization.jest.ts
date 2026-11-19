// The UI tests run without Expo's native modules: the system language reads as Simplified Chinese,
// the language the tests were written in.
const locales = [{ languageTag: 'zh-CN', languageCode: 'zh' }]
export const getLocales = () => locales
export const useLocales = () => locales
