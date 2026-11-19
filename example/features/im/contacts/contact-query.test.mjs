import assert from 'node:assert/strict'
import test from 'node:test'
import { parseContactQuery } from './contact-query.ts'

test('an @ makes an email, kept as typed but trimmed', () => {
  assert.deepEqual(parseContactQuery('  Alice@Example.com '), { kind: 'email', email: 'Alice@Example.com' })
})

test('a mainland mobile number is read with or without +86 and separators', () => {
  for (const text of ['13800138000', '+8613800138000', '86 138 0013 8000', '+86-138-0013-8000'])
    assert.deepEqual(parseContactQuery(text), { kind: 'phone', areaCode: '+86', phoneNumber: '13800138000' }, text)
})

test('another country needs its code and a separator', () => {
  assert.deepEqual(parseContactQuery('+1 4155550100'), { kind: 'phone', areaCode: '+1', phoneNumber: '4155550100' })
  assert.deepEqual(parseContactQuery('+852-91234567'), { kind: 'phone', areaCode: '+852', phoneNumber: '91234567' })
})

test('anything else is a user ID, including the 10-digit IDs the server hands out', () => {
  for (const text of ['alice', '4839201756', '1380013800', '+14155550100'])
    assert.equal(parseContactQuery(text).kind, 'id', text)
})
