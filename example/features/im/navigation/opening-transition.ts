type TransitionEvent = { data?: { closing?: boolean } }

/** The part of a native-stack navigation object the opening transition needs. */
export interface NavigationWithTransitions {
  addListener: (event: 'transitionStart' | 'transitionEnd', listener: (event: TransitionEvent) => void) => () => void
  getParent?: () => NavigationWithTransitions | undefined
}

/**
 * Listens to the push that opens a chat page starting or ending. Opened from the Chats tab, the
 * page is the first screen of the nested `chats` stack, so the push is the root stack's; opened
 * from inside `chats` (archived, search) it is the nested stack's own. Both are listened to.
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
