// Pending transitions and live page readiness only; no message data is retained here.
const mounted = new Map<string, Set<symbol>>()
const pending = new Map<string, Set<(ready: boolean) => void>>()
const entryKey = (account: string, id: string) => JSON.stringify([account, id])

export function waitForChatEntry (account: string, id: string) {
  const key = entryKey(account, id)
  if (mounted.has(key))
    return { ready: Promise.resolve(true), cancel: () => {} }
  let settle: (ready: boolean) => void = () => {}
  const ready = new Promise<boolean>(resolve => {
    const finish = (value: boolean) => {
      clearTimeout(timer)
      const listeners = pending.get(key)
      listeners?.delete(finish)
      if (!listeners?.size)
        pending.delete(key)
      resolve(value)
    }
    const timer = setTimeout(() => finish(false), 1500)
    const listeners = pending.get(key) || new Set<(ready: boolean) => void>()
    listeners.add(finish)
    pending.set(key, listeners)
    settle = finish
  })
  return { ready, cancel: () => settle(false) }
}

export function notifyChatEntryReady (account: string, id: string) {
  pending.get(entryKey(account, id))?.forEach(resolve => resolve(true))
}

/** A lease lasts only while the actual page has usable history and a ready list. */
export function registerChatEntryReady (account: string, id: string) {
  const key = entryKey(account, id)
  const lease = Symbol()
  const pages = mounted.get(key) || new Set<symbol>()
  pages.add(lease)
  mounted.set(key, pages)
  notifyChatEntryReady(account, id)
  return () => {
    pages.delete(lease)
    if (!pages.size)
      mounted.delete(key)
  }
}

export function isChatEntryReady (account: string, id: string) {
  return mounted.has(entryKey(account, id))
}
