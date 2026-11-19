import assert from 'node:assert/strict'
import test from 'node:test'
import { friendQRValue, qrPath, userIDFromQR } from './friend-qr.ts'

test('a 我的二维码 code reads back as the same user ID', () => {
  for (const id of ['alice', 'user 01', '张三', 'a/b?c'])
    assert.equal(userIDFromQR(friendQRValue(id)), id)
  assert.equal(friendQRValue('alice'), 'example:///chats/people/alice')
})

test('codes that are not ours are not read as a user', () => {
  for (const value of [undefined, '', 'alice', 'https://example.com/chats/people/alice', 'example:///chats/groups/g1', 'example:///chats/people/', 'example:///chats/people/%E0%A4%A'])
    assert.equal(userIDFromQR(value), undefined, value)
  assert.equal(userIDFromQR('  example://chats/people/bob  '), 'bob')
})

test('a code is drawn as one path of unit squares, at the highest error correction', () => {
  const { size, d } = qrPath(friendQRValue('alice'))
  // Version 4 at level H holds this link: 33 modules a side.
  assert.equal(size, 33)
  assert.match(d, /^(M\d+ \d+h1v1h-1z)+$/)
  // The three finder patterns: a 7×7 ring at three corners.
  assert.ok(d.startsWith('M0 0h1v1h-1zM1 0h1v1h-1z'))
})
