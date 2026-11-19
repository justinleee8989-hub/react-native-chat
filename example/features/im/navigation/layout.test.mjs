import test from 'node:test'
import assert from 'node:assert/strict'
import { productSection, isDesktopProduct } from './layout.ts'
test('deep links keep their matching master section', () => {
  assert.equal(productSection('/chats/groups/requests'), 'contacts')
  assert.equal(productSection('/chats/people/alice'), 'contacts')
  assert.equal(productSection('/chats/people/alice/more'), 'contacts')
  assert.equal(productSection('/chats/add-friend'), 'contacts')
  assert.equal(productSection('/chats/friend-requests'), 'contacts')
  assert.equal(productSection('/chats/settings'), 'me')
  assert.equal(productSection('/chats/appearance'), 'me')
  assert.equal(productSection('/chats/chat-wallpaper'), 'me')
  assert.equal(productSection('/chats/chat-wallpaper-colors'), 'me')
  assert.equal(productSection('/chats/my-qr'), 'me')
  assert.equal(productSection('/chats/scan'), 'contacts')
  assert.equal(productSection('/chats/call-history'), 'calls')
  assert.equal(productSection('/calls'), 'calls')
  assert.equal(productSection('/chats/call'), 'chats')
  assert.equal(productSection('/chats/conversation/id'), 'chats')
})
test('desktop breakpoint does not change mobile navigation', () => {
  assert.equal(isDesktopProduct(899), false)
  assert.equal(isDesktopProduct(900), true)
})
