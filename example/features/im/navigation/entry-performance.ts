// Opt-in Release diagnostics. Never include account IDs, tokens or message content.
const enabled = process.env.EXPO_PUBLIC_OPENIM_ENTRY_TRACE === '1'
const samples = new Map<string, number>()
let nextSample = 0

export function traceChatEntry (account: string, id: string, phase: string) {
  if (!enabled)
    return
  const key = JSON.stringify([account, id])
  let sample = samples.get(key)
  if (sample === undefined) {
    sample = ++nextSample
    if (samples.size >= 20)
      samples.delete(samples.keys().next().value!)
    samples.set(key, sample)
  }
  console.info('[IMEntry]', JSON.stringify({ sample, phase, atMs: Math.round(performance.now()) }))
}
