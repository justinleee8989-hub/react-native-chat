// Opt-in Release diagnostics (EXPO_PUBLIC_OPENIM_ENTRY_TRACE=1), read from `adb logcat`.
// Never log account or group IDs, tokens or message content.
// `process` is checked first: the store tests run modules in a bare VM context without it.
export const diagnosticsEnabled = typeof process !== 'undefined' && process.env.EXPO_PUBLIC_OPENIM_ENTRY_TRACE === '1'

/** One `[tag] {json}` line, when diagnostics are on. */
export function diagnostic (tag: string, line: Record<string, unknown>) {
  if (diagnosticsEnabled)
    console.info(`[${tag}]`, JSON.stringify(line))
}
