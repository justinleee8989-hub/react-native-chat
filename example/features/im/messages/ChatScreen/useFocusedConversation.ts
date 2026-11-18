import { useCallback } from 'react'
import { useFocusEffect } from 'expo-router'
import { subscribeForeground } from '../../application/foreground'
import { focusConversation, reportError, resumeConversation } from '../../application/store'
import type { Session } from '../../domain/types'

/**
 * While this chat is focused it is the store's active conversation, and returning to the
 * foreground resumes it; `onForeground` lets the page ask its own data again too.
 */
export function useFocusedConversation ({ id, session, available, onForeground }: {
  id: string
  session?: Session
  available: boolean
  onForeground: () => void
}) {
  useFocusEffect(
    useCallback(() => {
      if (!session || !available)
        return
      const stopConversation = focusConversation(id)
      const unsubscribeForeground = subscribeForeground(() => {
        onForeground()
        void resumeConversation(id, session).catch(reportError)
      })
      return () => {
        unsubscribeForeground()
        stopConversation()
      }
    }, [id, session, available, onForeground])
  )
}
