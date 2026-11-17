const conversationRoutePrefixes = [
  '/chats/',
  '/chats/conversation/',
  '/chats/search/',
  '/chats/assets/',
  '/chats/readers/',
]

export function isChatRouteActive (pathname: string, conversationID: string) {
  if (!conversationID)
    return false

  return conversationRoutePrefixes.some(prefix => {
    if (!pathname.startsWith(prefix))
      return false

    const encodedID = pathname.slice(prefix.length)
    if (!encodedID || encodedID.includes('/'))
      return false

    try {
      return decodeURIComponent(encodedID) === conversationID
    } catch {
      return false
    }
  })
}
