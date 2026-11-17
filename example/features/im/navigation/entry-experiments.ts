import { useSyncExternalStore } from 'react'
import { entryTraceEnabled } from './entry-performance'

/**
 * Chat-entry experiments, switchable at runtime from the panel on the chat list so one diagnostic
 * Release (EXPO_PUBLIC_OPENIM_ENTRY_TRACE=1) can compare them. In a normal Release the panel is
 * hidden and the defaults below apply. See docs/openim/ENTRY_PERF_TEST.md.
 */
export interface EntryExperiments {
  /**
   * `wait-ready`: the list stays on screen until the real chat page has laid out its message list
   * off-screen, then navigates (the existing behaviour).
   * `navigate-now`: navigates on the tap; the page builds while it slides in.
   */
  entryMode: 'wait-ready' | 'navigate-now'
  /** React Activity on the root and `chats` stacks (`activityEnabled`). */
  activity: 'on' | 'off'
  /**
   * When the message list grows its off-screen buffer (drawDistance 600 → up to 2400) after it is
   * ready. `after-transition`: once the push animation ends (700ms fallback), so the extra rows
   * are not built while the page slides in. `two-frames`: two frames after ready (the old way).
   */
  bufferExpand: 'after-transition' | 'two-frames'
  /**
   * The push animation of the chat pages (react-native-screens `animation`). On Android the
   * `default` push measured 380–460ms on its own (ENTRY_PERF_RESULTS.md), the floor of the entry.
   */
  animation: 'default' | 'slide_from_right' | 'ios_from_right' | 'fade' | 'fade_from_bottom' | 'none'
  /**
   * How far beyond the viewport the list first builds rows. `viewport`: only what is on screen
   * (drawDistance 0), so a page that was not prepared ahead builds as few rows as possible before
   * it can open; the buffer grows after the push as before. `600`: the round-two behaviour.
   */
  firstBuffer: 'viewport' | '600'
  /**
   * How many recent chats the list prepares off-screen after it gains focus, one after another.
   * `1` is the existing behaviour; `3` tests whether several prepared pages can be kept at once.
   */
  prewarm: '1' | '3'
}

const DEFAULTS: EntryExperiments = {
  entryMode: 'wait-ready',
  activity: 'on',
  bufferExpand: 'after-transition',
  // Round two: the default Android push took ~450ms, ios_from_right ~170ms (ENTRY_PERF_RESULTS_2.md).
  animation: 'ios_from_right',
  firstBuffer: 'viewport',
  prewarm: '1',
}

const CHOICES: { [K in keyof EntryExperiments]: EntryExperiments[K][] } = {
  entryMode: ['wait-ready', 'navigate-now'],
  activity: ['on', 'off'],
  bufferExpand: ['after-transition', 'two-frames'],
  animation: ['ios_from_right', 'default', 'slide_from_right', 'fade', 'fade_from_bottom', 'none'],
  firstBuffer: ['viewport', '600'],
  prewarm: ['1', '3'],
}

let current = DEFAULTS
const listeners = new Set<() => void>()

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export const getEntryExperiments = () => current

export const useEntryExperiments = () => useSyncExternalStore(subscribe, getEntryExperiments, getEntryExperiments)

/** Moves one experiment to its next choice. Only the diagnostic build offers it. */
export function cycleEntryExperiment (key: keyof EntryExperiments) {
  if (!entryTraceEnabled)
    return
  const choices = CHOICES[key] as string[]
  const next = choices[(choices.indexOf(current[key]) + 1) % choices.length]
  current = { ...current, [key]: next }
  listeners.forEach(listener => listener())
}

export const describeEntryExperiments = (value = current) =>
  `entry=${value.entryMode} activity=${value.activity} buffer=${value.bufferExpand} anim=${value.animation} first=${value.firstBuffer} prewarm=${value.prewarm}`
