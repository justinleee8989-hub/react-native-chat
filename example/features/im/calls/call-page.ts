/**
 * Whether the call page is open here, or still closing. It is a modal of its own, and iOS opens
 * no other modal over one that is open or closing: one asked for then never shows, and stays over
 * the app, unseen, taking every touch. So the call overlay waits for this to clear.
 */
const CLOSING_MS = 600

let open = 0
let covered = false
let closing: ReturnType<typeof setTimeout> | undefined
const listeners = new Set<() => void>()

function set (value: boolean) {
  if (covered === value)
    return
  covered = value
  listeners.forEach(listener => listener())
}

export const callPage = {
  /** Marks the page open; the returned function marks it closed, once it has had time to close. */
  open () {
    open++
    clearTimeout(closing)
    set(true)
    let closed = false
    return () => {
      if (closed)
        return
      closed = true
      open--
      if (!open)
        closing = setTimeout(() => set(false), CLOSING_MS)
    }
  },
  covered: () => covered,
  subscribe (listener: () => void) {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
}
