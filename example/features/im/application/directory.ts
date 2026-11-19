import { subscribeDirectoryEvents } from '../domain/directory-events'
import { client } from '../infrastructure/openim/client'

export { directory } from '../infrastructure/openim/directory-client'
export { findUserIDByContact } from '../infrastructure/openim/contact-lookup-api'
export { contactDirectoryEvents, groupDirectoryEvents } from '../domain/directory-events'

export function subscribeDirectory (events: string[], invalidate: () => void, groupID?: string) {
  return subscribeDirectoryEvents(client.on, events, invalidate, groupID)
}
