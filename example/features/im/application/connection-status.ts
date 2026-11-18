import { useSyncExternalStore } from 'react'

/**
 * What the user is told whenever the IM server cannot be reached, whatever the cause: the app keeps
 * them in and connects again by itself, so there is nothing else for them to do or read.
 */
export const offlineStatus = '网络异常，无法连接服务器'

type Source = { subscribe: (listener: () => void) => () => void, status: () => string }
let source: Source | undefined
const unsubscribed = () => () => {}
const unknown = () => ''

/** The store registers its runtime here, so screens can read the status without importing it. */
export function provideConnectionStatus (next: Source) {
  source = next
}

/** The connection status alone: a component reading only it is not re-rendered by every update. */
export function useConnectionStatus () {
  return useSyncExternalStore(source?.subscribe ?? unsubscribed, source?.status ?? unknown, source?.status ?? unknown)
}
