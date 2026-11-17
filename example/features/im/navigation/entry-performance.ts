// Opt-in Release diagnostics. Never include account IDs, tokens or message content.
// Each line: [IMEntry] {"sample","phase","atMs","sinceMs"?,"detail"?,"rows"?}. `sinceMs` counts from the
// finger going down on that conversation (`press-in`), or from the press itself (`press-cached` /
// `press-cold`) when there was no press-in just before. See docs/openim/entry-perf-2026-11-18/TEST_1.md.
export const entryTraceEnabled = process.env.EXPO_PUBLIC_OPENIM_ENTRY_TRACE === '1'

/** How long after a press long JS frames are reported, and what counts as long. */
const WATCH_MS = 2500
const LONG_FRAME_MS = 34
/** A press within this long of a press-in belongs to the same tap and keeps its clock. */
const SAME_TAP_MS = 1500
/** Page commits are logged up to this many per press; more is reported once as a summary. */
const MAX_RENDER_LINES = 12

interface Sample {
  id: number
  pressAt?: number
  watch: number
  once: Set<string>
  renders: number
  rows: number
}

const samples = new Map<string, Sample>()
let nextSample = 0
/** The conversation pressed last: message rows count towards it. */
let activeSample: Sample | undefined
/** Phases that also report how many message rows have rendered since the press. */
const ROW_PHASES = new Set(['list-ready', 'navigate', 'transition-start', 'transition-end'])

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now())

function sampleFor (account: string, id: string) {
  const key = JSON.stringify([account, id])
  let sample = samples.get(key)
  if (!sample) {
    sample = { id: ++nextSample, watch: 0, once: new Set(), renders: 0, rows: 0 }
    if (samples.size >= 20)
      samples.delete(samples.keys().next().value!)
    samples.set(key, sample)
  }
  return sample
}

function write (sample: Sample, phase: string, detail?: string) {
  const at = now()
  const line: Record<string, unknown> = { sample: sample.id, phase, atMs: Math.round(at) }
  if (sample.pressAt !== undefined)
    line.sinceMs = Math.round(at - sample.pressAt)
  if (detail)
    line.detail = detail
  if (sample === activeSample && ROW_PHASES.has(phase))
    line.rows = sample.rows
  console.info('[IMEntry]', JSON.stringify(line))
}

/** Watches the JS thread for long frames after a press, until the next press or WATCH_MS. */
function watchFrames (sample: Sample) {
  const watch = ++sample.watch
  let last = now()
  const tick = () => {
    if (watch !== sample.watch)
      return
    const t = now()
    if (t - last > LONG_FRAME_MS)
      write(sample, 'long-frame', `${Math.round(t - last)}ms`)
    last = t
    if (sample.pressAt !== undefined && t - sample.pressAt < WATCH_MS)
      requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}

export function traceChatEntry (account: string, id: string, phase: string, detail?: string) {
  if (!entryTraceEnabled)
    return
  const sample = sampleFor(account, id)
  const t = now()
  const isSameTap = phase !== 'press-in' && sample.pressAt !== undefined && t - sample.pressAt < SAME_TAP_MS
  if (phase.startsWith('press') && !isSameTap) {
    sample.pressAt = t
    sample.once.clear()
    sample.renders = 0
    sample.rows = 0
    activeSample = sample
    write(sample, phase, detail)
    watchFrames(sample)
    return
  }
  write(sample, phase, detail)
}

/** Like traceChatEntry, but only the first time a phase happens after a press. */
export function traceChatEntryOnce (account: string, id: string, phase: string, detail?: string) {
  if (!entryTraceEnabled)
    return
  const sample = sampleFor(account, id)
  if (sample.once.has(phase))
    return
  sample.once.add(phase)
  traceChatEntry(account, id, phase, detail)
}

/**
 * Counts the chat page's commits after a press: each one can walk the whole message list, so how
 * many happen before the page is ready says how much of the wait is re-rendering.
 */
export function traceChatRender (account: string, id: string) {
  if (!entryTraceEnabled)
    return
  const sample = sampleFor(account, id)
  sample.renders += 1
  if (sample.renders <= MAX_RENDER_LINES)
    write(sample, 'page-commit', `#${sample.renders}`)
  else if (sample.renders === MAX_RENDER_LINES + 1)
    write(sample, 'page-commit', `more than ${MAX_RENDER_LINES}; further commits not logged`)
}

/**
 * Counts message-row renders towards the conversation pressed last. Reported as `rows` on the
 * list-ready, navigate and transition lines: how many rows the entry built or rebuilt.
 */
export function countRowRender () {
  if (!entryTraceEnabled || !activeSample)
    return
  activeSample.rows += 1
}
