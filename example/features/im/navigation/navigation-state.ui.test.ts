import { expect, it } from '@jest/globals'
import { conversationOf, createSectionHistory, persistentSnapshot, sectionDetailDepth, sectionFromState, sectionRoot, withoutPreparedChat } from './navigation-state'

const tabs = (routes: { name: string, state?: any }[], index: number): any => ({ index, routes })
const rootState = (tabState: any, extra: Record<string, unknown> = {}): any => ({ ...extra, index: 0, routes: [{ name: '(tabs)', state: tabState }, { name: 'modal', key: 'modal-key' }] })

it('derives the visible section from nested tabs and maps groups to contacts', () => {
  const state = rootState(tabs([{ name: 'chats' }, { name: 'contacts' }, { name: 'groups' }, { name: 'me' }], 2))
  expect(sectionFromState(state, 'chats')).toBe('contacts')
  expect(sectionFromState(rootState(tabs([{ name: 'chats' }, { name: 'contacts' }, { name: 'groups' }, { name: 'me' }], 3)), 'chats')).toBe('me')
  expect(sectionFromState(rootState(tabs([{ name: 'chats' }, { name: 'calls' }, { name: 'contacts' }, { name: 'me' }], 1)), 'chats')).toBe('calls')
  expect(sectionFromState({ routes: [{ name: 'outside-tabs' }] }, 'chats')).toBe('chats')
})

it('builds a root snapshot targeting an existing section tab', () => {
  const state = rootState(tabs([{ name: 'chats', state: { routes: [{ name: 'index' }] } }, { name: 'contacts' }, { name: 'me' }], 0), { stale: false })
  const target: any = sectionRoot(state, 'me')
  expect(target.routes).toHaveLength(1)
  expect(target.routes[0].name).toBe('(tabs)')
  expect(target.index).toBe(0)
  expect(target.routes[0].state.index).toBe(2)
  expect(target.routes[0].state.routes.map((route: any) => route.name)).toEqual(['chats', 'contacts', 'me'])
  expect(state.routes).toHaveLength(2)
})

it('removes call routes recursively, adjusts indexes, and retains call history', () => {
  const state = rootState(tabs([
    { name: 'chats', state: { index: 2, routes: [{ name: 'index' }, { name: 'call-history' }, { name: 'call' }, { name: 'chat', state: { index: 1, routes: [{ name: 'index' }, { name: 'chats/call' }] } }] } },
    { name: 'contacts' },
  ], 0))
  const snapshot: any = persistentSnapshot(state)
  const cleaned: any = snapshot.routes[0].state.routes[0].state
  expect(cleaned.routes.map((route: any) => route.name)).toEqual(['index', 'call-history', 'chat'])
  expect(cleaned.index).toBe(1)
  expect(cleaned.routes[2].state.routes.map((route: any) => route.name)).toEqual(['index'])
  expect(state.routes[0].state.routes[0].state.routes).toHaveLength(4)
})

it('restores a section snapshot immutably and clears history when the account changes', () => {
  const history = createSectionHistory()
  const chats = rootState(tabs([{ name: 'chats', state: { routes: [{ name: 'index' }, { name: 'chat', params: { id: 'chat-7' } }] } }, { name: 'contacts' }, { name: 'me' }], 0))
  const current = rootState(tabs([{ name: 'chats' }, { name: 'contacts' }, { name: 'me' }], 1))
  history.remember('account-a', 'chats', chats)
  chats.routes[0].state.routes[0].state.routes[1].params.id = 'mutated'
  const restored: any = history.target('account-a', 'chats', current)
  const me: any = history.target('account-a', 'me', current)
  expect(restored.routes[0].state.routes[0].state.routes[1].params.id).toBe('chat-7')
  expect(me.routes[0].state.index).toBe(2)
  const accountB: any = history.target('account-b', 'chats', current)
  expect(accountB.routes[0].state.routes[0].name).toBe('chats')
  expect(accountB.routes[0].state.routes[0].state).toBeUndefined()
})

it('counts detail depth across the tabs and active chat stack', () => {
  const atTabs = rootState(tabs([{ name: 'chats' }, { name: 'contacts' }, { name: 'me' }], 0))
  const firstDetail = { index: 1, routes: [atTabs.routes[0], { name: 'chats', state: { index: 0, routes: [{ name: 'index' }] } }] }
  const nestedDetail = { ...firstDetail, routes: [atTabs.routes[0], { name: 'chats', state: { index: 1, routes: [{ name: 'index' }, { name: 'chat', params: { id: 'c-1' } }] } }] }
  expect(sectionDetailDepth(atTabs)).toBe(0)
  expect(sectionDetailDepth(firstDetail)).toBe(1)
  expect(sectionDetailDepth(nestedDetail)).toBe(2)
})

it('unwraps and preserves the real __root wrapper while targeting and restoring a section', () => {
  const state: any = {
    key: 'navigator:root',
    index: 0,
    routes: [{
      name: '__root',
      key: '__root:0',
      state: {
        key: 'navigator:0',
        type: 'stack',
        index: 1,
        routes: [
          { name: '(tabs)', state: { type: 'tab', index: 0, routes: [{ name: 'chats' }, { name: 'contacts' }, { name: 'me' }] } },
          { name: 'chats', state: { index: 1, routes: [{ name: 'index' }, { name: 'chat', params: { id: 'chat-42' } }] } },
        ],
      },
    }],
  }
  expect(sectionFromState(state, 'contacts')).toBe('chats')
  const target: any = sectionRoot(state, 'me')
  expect(target.key).toBe('navigator:root')
  expect(target.routes).toHaveLength(1)
  expect(target.routes[0].name).toBe('__root')
  expect(target.routes[0].state.key).toBe('navigator:0')
  expect(target.routes[0].state.routes.map((route: any) => route.name)).toEqual(['(tabs)'])
  expect(target.routes[0].state.routes[0].state.index).toBe(2)
  const history = createSectionHistory()
  history.remember('account-a', 'chats', state)
  const rootOnly: any = history.target('account-a', 'me', state)
  const restored: any = history.target('account-a', 'chats', rootOnly)
  expect(restored.routes[0].name).toBe('__root')
  expect(restored.routes[0].state.routes.map((route: any) => route.name)).toEqual(['(tabs)', 'chats'])
  expect(restored.routes[0].state.routes[1].state.routes[1].params.id).toBe('chat-42')
})

it('drops the conversation prepared off-screen unless it is the one being opened', () => {
  // As router.prefetch leaves it: after the focused index, with the conversation as nested state.
  const prepared = { key: 'chats-preloaded', name: 'chats', isPreloaded: true, state: { index: 0, routes: [{ name: '[id]', params: { id: 'si_alice_bob' } }] } }
  const stack = { key: 'stack', index: 0, stale: false, routes: [{ key: 'tabs', name: '(tabs)' }, prepared] }
  const root = { key: 'root', index: 0, routes: [{ name: '__root', state: stack }] }
  const next: any = withoutPreparedChat(root)
  expect(next.key).toBe('root')
  expect(next.routes[0].state.index).toBe(0)
  expect(next.routes[0].state.routes.map((route: any) => route.key)).toEqual(['tabs'])
  expect(withoutPreparedChat(root, 'si_alice_bob')).toBeUndefined()
  expect(withoutPreparedChat(root, 'other')).toBeTruthy()
  // An open conversation (at or before the focused index) is never touched.
  expect(withoutPreparedChat({ key: 'stack', index: 1, routes: [{ name: '(tabs)' }, prepared] })).toBeUndefined()
})

it('reads the conversation id from a conversation href only', () => {
  expect(conversationOf('/chats/si_alice_bob')).toBe('si_alice_bob')
  expect(conversationOf('/chats/a%20b')).toBe('a b')
  expect(conversationOf('/chats/people/charlie')).toBeUndefined()
  expect(conversationOf('/(tabs)/contacts')).toBeUndefined()
})
