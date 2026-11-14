import type { Session } from '../domain/types'
import { client } from '../infrastructure/openim/client'
import { createAssetsPager } from './assets'
import { createMessageProjectionService } from './projection'

export function createConversationAssetsPager (session: Session, url: string, isCurrent: () => boolean) {
  const projection = createMessageProjectionService(session, url)
  return createAssetsPager({
    history: (conversationID, cursor) => client.history(conversationID, cursor),
    project: (conversationID, messageIDs) => projection.load(conversationID, messageIDs),
    isCurrent,
  })
}
