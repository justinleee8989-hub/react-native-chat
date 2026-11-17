import React, { createContext, useContext, useState } from 'react'
import type { Session } from '../domain/types'

// UI readiness only. Messages and persisted snapshots remain owned by the IM store.
const StartupReadiness = createContext<{
  readySession?: Session
  markReady: (session: Session) => void
}>({ markReady: () => {} })

export function StartupReadinessProvider ({ children }: React.PropsWithChildren) {
  const [readySession, markReady] = useState<Session>()
  return <StartupReadiness.Provider value={{ readySession, markReady }}>{children}</StartupReadiness.Provider>
}
export const useStartupReadiness = () => useContext(StartupReadiness)
