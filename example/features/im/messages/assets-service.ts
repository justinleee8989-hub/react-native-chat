import { loadServerHistory } from '../application/store'
import type { Session } from '../domain/types'
import { extractAssets } from './assets'

export function createConversationAssetsPager (_session: Session, _url: string, isCurrent: () => boolean) {
  let cursor = ''
  let done = false
  return {
    async loadNext (conversationID: string) {
      if (!isCurrent())
        throw new Error('页面已变化，请重新打开')
      if (done)
        return { assets: [], done }
      const page = await loadServerHistory({ conversationID, cursor })
      if (!isCurrent())
        throw new Error('页面已变化，请重新打开')
      cursor = page.cursor
      done = !page.hasMore
      return { assets: extractAssets(page.messages), done }
    },
  }
}
