export type ProductSection = 'chats' | 'contacts' | 'calls' | 'me'
export function isDesktopProduct (width: number) {
  return width >= 900
}
export function productSection (path: string): ProductSection {
  if (/\/(groups|contacts|people|profile|add-friend|friend-requests|scan)(\/|$)/.test(path))
    return 'contacts'
  if (/\/(calls|call-history)(\/|$)/.test(path))
    return 'calls'
  if (/\/(me|settings|account|appearance|chat-wallpaper|chat-wallpaper-colors|my-qr)(\/|$)/.test(path))
    return 'me'
  return 'chats'
}
