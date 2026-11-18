import { useEffect, useLayoutEffect } from 'react'
import { useNavigation } from 'expo-router'
import { traceChatEntryOnce, traceChatRender } from '../../navigation/entry-performance'
import { type NavigationWithTransitions, onOpeningTransition } from '../../navigation/opening-transition'

/**
 * The push that opens this page: traced (diagnostics only, as is the per-commit line), and
 * `onEnd` lets the list grow its off-screen buffer once the page has slid in.
 */
export function useOpeningTransition (entryAccount: string, id: string, onEnd: () => void) {
  useLayoutEffect(() => {
    traceChatRender(entryAccount, id)
  })
  const navigation = useNavigation() as unknown as NavigationWithTransitions
  useEffect(() => {
    const offStart = onOpeningTransition(navigation, 'transitionStart', () => traceChatEntryOnce(entryAccount, id, 'transition-start'))
    const offEnd = onOpeningTransition(navigation, 'transitionEnd', () => {
      traceChatEntryOnce(entryAccount, id, 'transition-end')
      onEnd()
    })
    return () => {
      offStart()
      offEnd()
    }
  }, [navigation, entryAccount, id, onEnd])
}
