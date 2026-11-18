export type ProductSection = 'chats' | 'contacts' | 'calls' | 'me'
export function isDesktopProduct (width: number) {
  return width >= 900
}
export function productSection (path: string): ProductSection {
  if (/\/(groups|contacts|people|profile|add-friend|friend-requests)(\/|$)/.test(path))
    return 'contacts'
  if (/\/(calls|call-history)(\/|$)/.test(path))
    return 'calls'
  if (/\/(me|settings|account)(\/|$)/.test(path))
    return 'me'
  return 'chats'
}
