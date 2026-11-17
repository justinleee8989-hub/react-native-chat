export type ProductSection = 'chats' | 'contacts' | 'me'
export function isDesktopProduct (width: number) {
  return width >= 900
}
export function productSection (path: string): ProductSection {
  if (/\/(groups|contacts|people|profile|add-friend|friend-requests)(\/|$)/.test(path))
    return 'contacts'
  if (/\/(me|settings|account|call-history)(\/|$)/.test(path))
    return 'me'
  return 'chats'
}
