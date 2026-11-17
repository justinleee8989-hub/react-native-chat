export function shortTime (time: number, now = Date.now()) {
  const date = new Date(time), today = new Date(now)
  if (!Number.isFinite(date.getTime()))
    return ''
  if (date.toDateString() === today.toDateString())
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  if (date.toDateString() === new Date(now - 86400000).toDateString())
    return '昨天'
  if (now - time < 6 * 86400000)
    return `周${'日一二三四五六'[date.getDay()]}`
  return `${date.getMonth() + 1}/${date.getDate()}`
}
export function groupReadCount (message: unknown, authoritativeCount?: number): number | undefined {
  if (typeof authoritativeCount === 'number' && Number.isSafeInteger(authoritativeCount) && authoritativeCount >= 0)
    return authoritativeCount
  if (!message || typeof message !== 'object')
    return undefined
  const info = (message as { attachedInfoElem?: { groupHasReadInfo?: { hasReadCount?: number } } }).attachedInfoElem?.groupHasReadInfo?.hasReadCount
  return typeof info === 'number' && Number.isSafeInteger(info) && info >= 0 ? info : undefined
}

export function messageTimestamp (date: Date, now = Date.now()) {
  if (!Number.isFinite(date.getTime()))
    return ''
  const time = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  const today = new Date(now)
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  if (date.toDateString() === today.toDateString())
    return time
  if (date.toDateString() === yesterday.toDateString())
    return `昨天 ${time}`
  return `${date.getMonth() + 1}月${date.getDate()}日 ${time}`
}
