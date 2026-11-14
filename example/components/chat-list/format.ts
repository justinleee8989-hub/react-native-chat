import type { Dialog } from './data'
/** "12,345 subscribers" in a channel's header. */
export function formatSubscribers (count: number): string {
  return `${count.toLocaleString('en-US')} subscribers`
}

export const dialogSubtitle = (dialog: Dialog) => dialog.isBot ? 'bot' : dialog.kind === 'group' ? `${(dialog.members?.length ?? 0) + 1} members` : dialog.kind === 'channel' ? formatSubscribers(dialog.subscribers ?? 0) : dialog.isOnline ? 'online' : dialog.lastSeen ?? 'last seen recently'
