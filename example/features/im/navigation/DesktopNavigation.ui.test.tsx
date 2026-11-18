import React from 'react'
import { Platform, Pressable, Text, View } from 'react-native'
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import { fireEvent, render } from '@testing-library/react-native'
import { DesktopNavigationProvider, useDesktopNavigation } from './DesktopNavigation'

let mockRoot: any
let mockSession: any
let mockNavigation: any
let mockRouter: any
let mockPath = '/chats'
jest.mock('expo-router', () => ({
  useNavigationContainerRef: () => mockNavigation,
  useRootNavigationState: () => mockRoot,
  useRouter: () => mockRouter,
  usePathname: () => mockPath,
}))
jest.mock('../application/store', () => ({ useOpenIM: () => ({ session: mockSession, conversations: [{ conversationID: 'chat-7' }, { conversationID: 'chat-8' }] }) }))
jest.mock('../ui/preferences', () => ({ useProductLayout: () => ({ desktop: true }) }))

function rootState (tabIndex = 0, detail = true) {
  const tabs = { key: 'tabs-key', index: tabIndex, routes: [
    { key: 'chats-key', name: 'chats', state: { key: 'chat-tab', index: 0, routes: [{ name: 'index' }] } },
    { key: 'contacts-key', name: 'contacts' },
    { key: 'me-key', name: 'me' },
  ] }
  return {
    key: 'root-key',
    index: detail ? 1 : 0,
    routes: [
      { key: 'tabs-route', name: '(tabs)', state: tabs },
      ...(detail ? [{ key: 'chat-stack', name: 'chats', state: { key: 'chat-stack-state', index: 1, routes: [{ name: 'index' }, { name: 'chat', params: { id: 'chat-7' } }] } }] : []),
    ],
  }
}

function wrappedRootState (detail = true) {
  const routes: any[] = [{ name: '(tabs)', state: { type: 'tab', index: 0, routes: [{ name: 'chats' }, { name: 'contacts' }, { name: 'me' }] } }]
  if (detail)
    routes.push({ name: 'chats', state: { index: 1, routes: [{ name: 'index' }, { name: 'chat', params: { id: 'real-chat-42' } }] } })
  return { key: 'navigator:root', index: 0, routes: [{ name: '__root', key: '__root:0', state: { key: 'navigator:0', type: 'stack', index: routes.length - 1, routes } }] }
}

function Probe () {
  const navigation = useDesktopNavigation()
  return <View>
    <Text testID='section'>{navigation?.section}</Text>
    <Text testID='back'>{String(navigation?.canGoBackInSection)}</Text>
    <Pressable testID='contacts' onPress={() => navigation?.switchSection('contacts')} />
    <Pressable testID='chats' onPress={() => navigation?.switchSection('chats')} />
    <Pressable testID='conversation' onPress={() => navigation?.openMaster('/chats/chat-8')} />
    <Pressable testID='master' onPress={() => navigation?.openMaster('/chats/new')} />
  </View>
}

const app = () => <DesktopNavigationProvider><Probe /></DesktopNavigationProvider>

describe('desktop navigation provider', () => {
  let originalPlatform: typeof Platform.OS
  beforeEach(() => {
    originalPlatform = Platform.OS
    Platform.OS = 'web'
    mockSession = { userID: 'account-a', imToken: 'token-a' }
    mockRoot = rootState()
    mockNavigation = { dispatch: jest.fn(), getRootState: jest.fn(() => mockRoot) }
    mockRouter = { push: jest.fn(), navigate: jest.fn(), replace: jest.fn(), dismissAll: jest.fn() }
    mockPath = '/chats'
  })
  afterEach(() => {
    Platform.OS = originalPlatform
  })

  it('keeps the initial authenticated deep link, then resets root state on account replacement', async () => {
    const view = await render(app())
    expect(mockNavigation.dispatch).not.toHaveBeenCalled()
    mockSession = { userID: 'account-b', imToken: 'token-b' }
    await view.rerender(app())
    expect(mockNavigation.dispatch).toHaveBeenCalledWith(expect.objectContaining({
      type: 'RESET',
      target: 'root-key',
      payload: expect.objectContaining({ routes: [expect.objectContaining({ name: '(tabs)' })] }),
    }))
  })

  it('preserves a deep link during initial credential hydration', async () => {
    mockSession = null
    const view = await render(app())
    mockSession = { userID: 'account-a', imToken: 'token-a' }
    await view.rerender(app())
    expect(mockNavigation.dispatch).not.toHaveBeenCalled()
  })

  it('keeps the original chats section for a deep link with no tabs while opening group detail', async () => {
    mockRoot = { key: 'navigator:root', index: 0, routes: [{ name: '__root', key: '__root:0', state: { key: 'navigator:0', type: 'stack', index: 0, routes: [{ name: 'chats', state: { index: 0, routes: [{ name: 'conversation', params: { id: '31059607' } }] } }] } }] }
    mockPath = '/chats/conversation/31059607'
    const view = await render(app())
    expect(view.getByTestId('section').props.children).toBe('chats')

    mockPath = '/chats/groups/31059607'
    await view.rerender(app())
    expect(view.getByTestId('section').props.children).toBe('chats')
    expect(mockNavigation.dispatch).not.toHaveBeenCalled()
  })

  it('restores the full chats stack when switching back from another desktop section', async () => {
    const view = await render(app())
    await fireEvent.press(view.getByTestId('contacts'))
    const contactsReset = mockNavigation.dispatch.mock.calls[0][0]
    expect(contactsReset.payload.routes).toHaveLength(1)
    expect(contactsReset.payload.routes[0].state.index).toBe(1)
    mockRoot = contactsReset.payload
    await view.rerender(app())

    await fireEvent.press(view.getByTestId('chats'))
    const chatsReset = mockNavigation.dispatch.mock.calls[1][0]
    expect(chatsReset.payload.routes.map((route: any) => route.name)).toEqual(['(tabs)', 'chats'])
    expect(chatsReset.payload.routes[1].state.routes[1].params.id).toBe('chat-7')
    expect(mockRouter.navigate).not.toHaveBeenCalled()
  })

  it('replaces a conversation directly without exposing the empty master screen', async () => {
    mockPath = '/chats/chat-7'
    const view = await render(app())
    await fireEvent.press(view.getByTestId('conversation'))
    expect(mockNavigation.dispatch).not.toHaveBeenCalled()
    expect(mockRouter.replace).toHaveBeenCalledWith('/chats/chat-8')
  })

  it('replaces any open detail in place, collapsing a deeper stack first, never through the empty master', async () => {
    const view = await render(app())
    await fireEvent.press(view.getByTestId('master'))
    expect(mockNavigation.dispatch).not.toHaveBeenCalled()
    expect(mockRouter.push).not.toHaveBeenCalled()
    expect(mockRouter.dismissAll).toHaveBeenCalledTimes(1)
    expect(mockRouter.replace).toHaveBeenCalledWith('/chats/new')
    expect(mockRouter.dismissAll.mock.invocationCallOrder[0]).toBeLessThan(mockRouter.replace.mock.invocationCallOrder[0])
  })

  it('replaces a single open detail without collapsing anything', async () => {
    mockRoot = rootState()
    mockRoot.routes[1].state = { key: 'chat-stack-state', index: 0, routes: [{ name: 'people/[id]', params: { id: 'alice' } }] }
    mockPath = '/chats/people/alice'
    const view = await render(app())
    await fireEvent.press(view.getByTestId('master'))
    expect(mockRouter.dismissAll).not.toHaveBeenCalled()
    expect(mockRouter.replace).toHaveBeenCalledWith('/chats/new')
  })

  it('does not push a pending master route after an account change', async () => {
    // A screen other than the detail stack is on top: the master route waits for the reset.
    mockRoot = rootState()
    mockRoot.routes[1] = { key: 'modal-route', name: 'modal' }
    const view = await render(app())
    await fireEvent.press(view.getByTestId('master'))
    expect(mockNavigation.dispatch).toHaveBeenCalledTimes(1)
    mockSession = { userID: 'account-b', imToken: 'token-b' }
    await view.rerender(app())
    expect(mockRouter.push).not.toHaveBeenCalled()
  })

  it('replaces in the actual __root stack, then restores deep chats state across sections', async () => {
    mockRoot = wrappedRootState()
    const view = await render(app())
    await fireEvent.press(view.getByTestId('master'))
    expect(mockNavigation.dispatch).not.toHaveBeenCalled()
    expect(mockRouter.dismissAll).toHaveBeenCalledTimes(1)
    expect(mockRouter.replace).toHaveBeenCalledWith('/chats/new')

    mockRoot = wrappedRootState()
    const switched = await render(app())
    await fireEvent.press(switched.getByTestId('contacts'))
    const contacts = mockNavigation.dispatch.mock.calls[0][0]
    expect(contacts.payload.routes[0].name).toBe('__root')
    mockRoot = contacts.payload
    await switched.rerender(app())
    await fireEvent.press(switched.getByTestId('chats'))
    const chats = mockNavigation.dispatch.mock.calls[1][0]
    expect(chats.payload.routes[0].state.routes.map((route: any) => route.name)).toEqual(['(tabs)', 'chats'])
    expect(chats.payload.routes[0].state.routes[1].state.routes[1].params.id).toBe('real-chat-42')
  })

  it('pushes immediately from the actual wrapped root-only state', async () => {
    mockRoot = wrappedRootState(false)
    const view = await render(app())
    await fireEvent.press(view.getByTestId('master'))
    expect(mockNavigation.dispatch).not.toHaveBeenCalled()
    expect(mockRouter.push).toHaveBeenCalledWith('/chats/new')
  })

  it('uses router navigation directly on native', async () => {
    Platform.OS = 'ios'
    const view = await render(app())
    await fireEvent.press(view.getByTestId('contacts'))
    await fireEvent.press(view.getByTestId('master'))
    expect(mockRouter.navigate).toHaveBeenCalledWith('/(tabs)/contacts')
    expect(mockRouter.push).toHaveBeenCalledWith('/chats/new')
    expect(mockNavigation.dispatch).not.toHaveBeenCalled()
  })
})
