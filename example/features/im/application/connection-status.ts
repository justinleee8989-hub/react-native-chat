import { useSyncExternalStore } from 'react'

/** Where the connection to the IM server stands; screens say it with `status.<value>`. */
export type ConnectionStatus = 'signedOut' | 'connecting' | 'fetching' | 'syncing' | 'connected' | 'syncFailed' | 'offline'

/**
 * The IM server cannot be reached, whatever the cause: the app keeps the user in and connects again
 * by itself, so there is nothing else for them to do or read.
 */
export const offlineStatus: ConnectionStatus = 'offline'

type Source = { subscribe: (listener: () => void) => () => void, status: () => ConnectionStatus }
let source: Source | undefined
const unsubscribed = () => () => {}
const unknown = (): ConnectionStatus => 'signedOut'

/** The store registers its runtime here, so screens can read the status without importing it. */
export function provideConnectionStatus (next: Source) {
  source = next
}

/** The connection status alone: a component reading only it is not re-rendered by every update. */
export function useConnectionStatus () {
  return useSyncExternalStore(source?.subscribe ?? unsubscribed, source?.status ?? unknown, source?.status ?? unknown)
}
