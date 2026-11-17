import { expect, it } from '@jest/globals'
import { groupReadCount, messageTimestamp } from './presentation'
it('matches reference today, yesterday and older separators across month boundaries', () => {
  const now = new Date(2026, 10, 1, 12).getTime()
  expect(messageTimestamp(new Date(2026, 10, 1, 9, 5), now)).toBe('09:05')
  expect(messageTimestamp(new Date(2026, 9, 31, 23, 4), now)).toBe('昨天 23:04')
  expect(messageTimestamp(new Date(2026, 9, 30, 8, 3), now)).toBe('10月30日 08:03')
  expect(messageTimestamp(new Date('invalid'), now)).toBe('')
})

it('prefers reader endpoint counts without modifying the SDK message payload', () => {
  const message = { attachedInfoElem: { groupHasReadInfo: { hasReadCount: 0 } } }
  expect(groupReadCount(message)).toBe(0)
  expect(groupReadCount(message, 1)).toBe(1)
  expect(message.attachedInfoElem.groupHasReadInfo.hasReadCount).toBe(0)
})
