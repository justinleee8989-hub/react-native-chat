import type { Translate } from '../i18n/translate.ts'
const clock = (date: Date, locale: string) =>
  new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date)

/** A list's time: the time today, then 昨天, a weekday within the week, else the day (3/12). */
export function shortTime (time: number, tr: Translate, now = Date.now()) {
  const date = new Date(time), today = new Date(now)
  if (!Number.isFinite(date.getTime()))
    return ''
  if (date.toDateString() === today.toDateString())
    return clock(date, tr.locale)
  if (date.toDateString() === new Date(now - 86400000).toDateString())
    return tr('time.yesterday')
  if (now - time < 6 * 86400000)
    return new Intl.DateTimeFormat(tr.locale, { weekday: 'short' }).format(date)
  return new Intl.DateTimeFormat(tr.locale, { month: 'numeric', day: 'numeric' }).format(date)
}
export function groupReadCount (message: unknown, authoritativeCount?: number): number | undefined {
  if (typeof authoritativeCount === 'number' && Number.isSafeInteger(authoritativeCount) && authoritativeCount >= 0)
    return authoritativeCount
  if (!message || typeof message !== 'object')
    return undefined
  const info = (message as { attachedInfoElem?: { groupHasReadInfo?: { hasReadCount?: number } } }).attachedInfoElem?.groupHasReadInfo?.hasReadCount
  return typeof info === 'number' && Number.isSafeInteger(info) && info >= 0 ? info : undefined
}

/** A message's time: the time today, 昨天 and the time, else the day and the time (3月12日 09:05). */
export function messageTimestamp (date: Date, tr: Translate, now = Date.now()) {
  if (!Number.isFinite(date.getTime()))
    return ''
  const time = clock(date, tr.locale)
  const today = new Date(now)
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  if (date.toDateString() === today.toDateString())
    return time
  if (date.toDateString() === yesterday.toDateString())
    return tr('time.yesterdayAt', { time })
  return `${new Intl.DateTimeFormat(tr.locale, { month: 'long', day: 'numeric' }).format(date)} ${time}`
}
