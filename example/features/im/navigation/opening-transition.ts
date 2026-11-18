type TransitionEvent = { data?: { closing?: boolean } }

/** The part of a native-stack navigation object the opening transition needs. */
export interface NavigationWithTransitions {
  addListener: (event: 'transitionStart' | 'transitionEnd', listener: (event: TransitionEvent) => void) => () => void
  getParent?: () => NavigationWithTransitions | undefined
}

/**
 * Listens to the transition that opens a page starting or ending; closing transitions are ignored.
 * A page that is the first screen of a nested stack (a chat opened from the Chats tab, the login
 * page after a sign-out) arrives with the root stack's transition; one pushed inside its own stack
 * (a chat from archived or search, login from 注册) with that stack's. Both are listened to.
 */
export function onOpeningTransition (
  navigation: NavigationWithTransitions | undefined,
  event: 'transitionStart' | 'transitionEnd',
  listener: () => void
) {
  if (!navigation?.addListener)
    return () => {}
  const navigators = [navigation, navigation.getParent?.()].filter(Boolean) as NavigationWithTransitions[]
  const unsubscribes = navigators.map(nav => nav.addListener(event, e => {
    if (!e?.data?.closing)
      listener()
  }))
  return () => unsubscribes.forEach(unsubscribe => unsubscribe())
}
