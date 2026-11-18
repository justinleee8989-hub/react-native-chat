import React, { createContext, useCallback, useContext, useState } from 'react'
import type { Session } from '../domain/types'

/**
 * The account a session belongs to. Readiness is per account, not per session object: a restore
 * can produce a new but identical session (a JS hot reload restores the store, then reads the saved
 * login again), and the home list, already laid out, does not report ready a second time, so the
 * startup cover waited for its 15s fallback.
 */
export const sessionKey = (session: Session | undefined) => session ? `${session.userID}:${session.imToken}` : ''

// UI readiness only. Messages and persisted snapshots remain owned by the IM store.
const StartupReadiness = createContext<{
  readyKey: string
  markReady: (session: Session) => void
}>({ readyKey: '', markReady: () => {} })

export function StartupReadinessProvider ({ children }: React.PropsWithChildren) {
  const [readyKey, setReadyKey] = useState('')
  const markReady = useCallback((session: Session) => setReadyKey(sessionKey(session)), [])
  return <StartupReadiness.Provider value={{ readyKey, markReady }}>{children}</StartupReadiness.Provider>
}
export const useStartupReadiness = () => useContext(StartupReadiness)
