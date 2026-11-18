import React, { createContext, useContext, useEffect, useRef, useState } from 'react'
import { Platform } from 'react-native'
import {
  type Href,
  useNavigationContainerRef,
  usePathname,
  useRootNavigationState,
  useRouter,
} from 'expo-router'
import { useOpenIM } from '../application/store'
import { useProductLayout } from '../ui/preferences'
import { productSection, type ProductSection } from './layout'
import {
  createSectionHistory,
  openDetailScreens,
  productNavigationState,
  sectionDetailDepth,
  sectionFromState,
  sectionRoot,
  type NavigationSnapshot,
} from './navigation-state'

type DesktopNavigation = {
  section: ProductSection
  canGoBackInSection: boolean
  switchSection: (section: ProductSection) => void
  openMaster: (href: Href) => void
}
const Context = createContext<DesktopNavigation | null>(null)

export function DesktopNavigationProvider ({ children }: React.PropsWithChildren) {
  const navigation = useNavigationContainerRef()
  const root = useRootNavigationState()
  const router = useRouter()
  const path = usePathname()
  const { desktop } = useProductLayout()
  const { session } = useOpenIM()
  const enabled = desktop && Platform.OS === 'web'
  const account = session ? `${session.userID}:${session.imToken}` : ''
  const previousAccount = useRef(account)
  const authenticatedAccount = useRef(account)
  const pending = useRef<{ account: string, section: ProductSection, href: Href } | null>(null)
  const [history] = useState(createSectionHistory)
  const [initialSection] = useState(() => productSection(path))
  const section = sectionFromState(root, initialSection)
  const reset = (snapshot: NavigationSnapshot) => {
    // A bare RESET is handled by the focused child stack, not the root navigator.
    navigation.dispatch({ type: 'RESET', payload: snapshot, target: navigation.getRootState().key })
  }
  useEffect(() => {
    if (!root?.routes.length)
      return
    if (previousAccount.current !== account) {
      const replacingAccount =
        !!authenticatedAccount.current && authenticatedAccount.current !== account
      previousAccount.current = account
      if (account)
        authenticatedAccount.current = account
      pending.current = null
      // Also drop snapshots on logout before another account can navigate.
      history.target(account, 'chats', root)
      // Initial credential hydration must preserve an authenticated deep link.
      if (
        enabled &&
        account &&
        replacingAccount &&
        productNavigationState(root)?.routes.some(route => route.name === '(tabs)')
      )
        navigation.dispatch({
          type: 'RESET',
          payload: sectionRoot(root, 'chats'),
          target: root.key,
        })
      return
    }
    if (!enabled || !account)
      return
    const next = pending.current
    if (next) {
      if (
        next.account === account &&
        productNavigationState(root)?.routes.length === 1 &&
        productNavigationState(root)?.routes[0].name === '(tabs)' &&
        sectionFromState(root, section) === next.section
      ) {
        pending.current = null
        router.push(next.href)
      }
      return
    }
    if (productNavigationState(root)?.routes.some(route => route.name === '(tabs)'))
      history.remember(account, section, root)
  }, [account, enabled, history, navigation, root, router, section])
  const switchSection = (next: ProductSection) => {
    if (next === section)
      return
    if (!enabled) {
      router.navigate(`/(tabs)/${next}` as Href)
      return
    }
    if (!account)
      return
    const current = navigation.getRootState()
    pending.current = null
    history.remember(account, sectionFromState(current, section), current)
    reset(history.target(account, next, current))
  }
  const openMaster = (href: Href) => {
    if (!enabled || !account) {
      router.push(href)
      return
    }
    const current = navigation.getRootState()
    if (
      productNavigationState(current)?.routes.length === 1 &&
      productNavigationState(current)?.routes[0].name === '(tabs)'
    ) {
      router.push(href)
      return
    }
    // A detail is open: replace it where it is, for any kind of item. Going back to the empty
    // master and pushing again unmounted and remounted the whole frame, and the master list
    // reloaded, on every click; only conversations were replaced in place before. Both steps run
    // in this one event, so the first screen of a deeper stack is never painted on its own.
    const screens = openDetailScreens(current)
    if (screens) {
      if (screens > 1)
        router.dismissAll()
      if (screens > 1 || path !== href)
        router.replace(href)
      return
    }
    pending.current = { account, section, href }
    reset(sectionRoot(current, section))
  }
  return (
    <Context.Provider
      value={{
        section,
        canGoBackInSection: !enabled || sectionDetailDepth(root) > 1,
        switchSection,
        openMaster,
      }}
    >
      {children}
    </Context.Provider>
  )
}

export function useDesktopNavigation () {
  return useContext(Context)
}

/** Without the desktop frame, retain the existing native/router behavior. */
export function useMasterNavigation () {
  const context = useDesktopNavigation()
  const router = useRouter()
  return context?.openMaster ?? ((href: Href) => router.push(href))
}
