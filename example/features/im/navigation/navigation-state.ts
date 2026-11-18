import type { ProductSection } from './layout'

export type NavigationSnapshot = {
  key?: string
  index?: number
  type?: string
  routes: { key?: string, name: string, params?: object, state?: NavigationSnapshot }[]
  [key: string]: unknown
}

/** Expo Router 58 wraps the product stack in its own root navigator. */
export function productNavigationState (state: NavigationSnapshot | undefined): NavigationSnapshot | undefined {
  const active = state?.routes[state.index ?? 0]
  return active?.name === '__root' && active.state ? productNavigationState(active.state) : state
}

function underlyingTabs (state: NavigationSnapshot | undefined) {
  state = productNavigationState(state)
  return state?.routes.slice(0, (state.index ?? state.routes.length - 1) + 1).findLast(route => route.name === '(tabs)')
}

export function sectionFromState (state: NavigationSnapshot | undefined, fallback: ProductSection): ProductSection {
  const tabs = underlyingTabs(state)?.state
  const name = tabs?.routes[tabs.index ?? 0]?.name
  if (name === 'groups')
    return 'contacts'
  return name === 'chats' || name === 'contacts' || name === 'calls' || name === 'me' ? name : fallback
}

export function sectionRoot (state: NavigationSnapshot, section: ProductSection): NavigationSnapshot {
  const active = state.routes[state.index ?? 0]
  if (active?.name === '__root' && active.state)
    return { ...state, routes: state.routes.map(route => route === active ? { ...route, state: sectionRoot(active.state!, section) } : route) }
  const existing = underlyingTabs(state)
  const tabs = existing?.state
  const index = tabs?.routes.findIndex(route => route.name === section) ?? -1
  const tabState = tabs && index >= 0
    ? { ...tabs, index, history: [{ type: 'route', key: tabs.routes[index].key }] }
    : { stale: true, index: 0, routes: [{ name: section }] }
  return { ...state, index: 0, routes: [{ ...existing, name: '(tabs)', state: tabState }] }
}

/** Calls are transient: revisiting a section must never reopen a terminated call. */
export function persistentSnapshot (state: NavigationSnapshot): NavigationSnapshot {
  const activeIndex = state.index ?? state.routes.length - 1
  const active = state.routes[activeIndex]
  const routes = state.routes.filter(route => route.name !== 'call' && route.name !== 'chats/call').map(route => ({
    ...route,
    ...(route.params ? { params: { ...route.params } } : {}),
    ...(route.state ? { state: persistentSnapshot(route.state) } : {}),
  })).filter(route => !route.state || route.state.routes.length > 0)
  const index = routes.findIndex(route => route.key ? route.key === active?.key : route.name === active?.name)
  const previous = state.routes.slice(0, activeIndex).filter(route => routes.some(saved => route.key ? saved.key === route.key : saved.name === route.name)).length - 1
  return { ...state, routes, index: index >= 0 ? index : Math.max(0, previous) }
}

export function createSectionHistory () {
  let account = ''
  let snapshots: Partial<Record<ProductSection, NavigationSnapshot>> = {}
  const scope = (next: string) => {
    if (account !== next) {
      account = next
      snapshots = {}
    }
  }
  return {
    remember (session: string, section: ProductSection, state: NavigationSnapshot) {
      scope(session)
      snapshots[section] = persistentSnapshot(state)
    },
    target (session: string, section: ProductSection, current: NavigationSnapshot) {
      scope(session)
      return snapshots[section] ? persistentSnapshot(snapshots[section]) : sectionRoot(current, section)
    },
  }
}

/** Count detail entries, excluding layout wrappers and the selected tab index. */
export function sectionDetailDepth (state: NavigationSnapshot | undefined): number {
  state = productNavigationState(state)
  if (!state?.routes.length)
    return 0
  const index = state.index ?? state.routes.length - 1
  const active = state.routes[index]
  if (!active || active.name === '(tabs)')
    return 0
  const tabIndex = state.routes.slice(0, index).findLastIndex(route => route.name === '(tabs)')
  let depth = tabIndex >= 0 ? index - tabIndex : 1
  let nested = active.state
  while (nested?.routes.length) {
    const selected = nested.index ?? 0
    if (nested.type !== 'tab' && nested.type !== 'drawer')
      depth += selected
    nested = nested.routes[selected]?.state
  }
  return depth
}

/**
 * The screens in the open detail stack (the `chats` stack over the tabs); 0 when the active route
 * is anything else.
 */
export function openDetailScreens (state: NavigationSnapshot | undefined): number {
  state = productNavigationState(state)
  const active = state?.routes[state.index ?? state.routes.length - 1]
  if (!active || active.name !== 'chats')
    return 0
  return active.state?.routes.length || 1
}

/** The conversation a `chats` route shows: its focused `[id]` screen. */
function preparedConversation (route: NavigationSnapshot['routes'][number]): unknown {
  const nested = route.state
  const focused = nested?.routes[nested.index ?? nested.routes.length - 1]
  return focused?.name === '[id]' ? (focused.params as { id?: unknown } | undefined)?.id : undefined
}

/**
 * The product stack without the conversation the chat list prepared off-screen, or undefined when
 * there is nothing to drop. `keep` names the conversation being opened, which stays prepared.
 *
 * `router.prefetch` keeps a prepared route in the stack after the focused index, and a PUSH reuses
 * a route found there by name, nested state included. So any other `/chats/...` page pushed while
 * a conversation was prepared opened on top of that conversation, and 返回 led into it.
 */
export function withoutPreparedChat (state: NavigationSnapshot | undefined, keep?: string): NavigationSnapshot | undefined {
  if (!state?.routes.length)
    return undefined
  // Returned whole from the root, as section switching resets it: Expo Router wraps the product
  // stack in its own root navigator.
  const active = state.routes[state.index ?? 0]
  if (active?.name === '__root' && active.state) {
    const nested = withoutPreparedChat(active.state, keep)
    return nested && { ...state, routes: state.routes.map(route => route === active ? { ...route, state: nested } : route) }
  }
  const index = state.index ?? state.routes.length - 1
  const routes = state.routes.filter((route, position) =>
    position <= index || route.name !== 'chats' || (!!keep && preparedConversation(route) === keep))
  return routes.length === state.routes.length ? undefined : { ...state, routes }
}

/** The one segment after `/chats/`: a conversation id when the href opens a conversation. */
export function conversationOf (href: string): string | undefined {
  const match = /^\/chats\/([^/?#]+)$/.exec(href)
  try {
    return match ? decodeURIComponent(match[1]) : undefined
  } catch {
    return undefined
  }
}
