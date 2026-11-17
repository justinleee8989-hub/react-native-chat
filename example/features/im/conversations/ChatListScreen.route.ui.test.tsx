import { describe, expect, it } from '@jest/globals'
import { isChatRouteActive } from './chat-route'

describe('isChatRouteActive', () => {
  it.each([
    '/chats/conversation/chat-7',
    '/chats/search/chat-7',
    '/chats/assets/chat-7',
    '/chats/readers/chat-7',
    '/chats/chat-7',
  ])('keeps the conversation selected at %s', pathname => {
    expect(isChatRouteActive(pathname, 'chat-7')).toBe(true)
  })

  it('matches encoded IDs as one exact path segment', () => {
    expect(isChatRouteActive('/chats/assets/a%2Fb%20%2B', 'a/b +')).toBe(true)
    expect(isChatRouteActive('/chats/assets/chat-70', 'chat-7')).toBe(false)
    expect(isChatRouteActive('/chats/assets/other', 'chat-7')).toBe(false)
    expect(isChatRouteActive('/chats/assets/chat-7/extra', 'chat-7')).toBe(false)
    expect(isChatRouteActive('/chats/assets/%E0%A4%A', 'chat-7')).toBe(false)
  })

  it('does not mark groups or list routes as the selected conversation', () => {
    expect(isChatRouteActive('/chats/groups/chat-7', 'chat-7')).toBe(false)
    expect(isChatRouteActive('/chats/group/chat-7', 'chat-7')).toBe(false)
    expect(isChatRouteActive('/chats/archived', 'chat-7')).toBe(false)
    expect(isChatRouteActive('/chats', 'chat-7')).toBe(false)
  })
})
