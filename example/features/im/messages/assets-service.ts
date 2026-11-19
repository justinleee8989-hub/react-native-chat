import { loadServerHistory } from '../application/store'
import type { Session } from '../domain/types'
import { ProductError } from '../shared/product-error.ts'
import { extractAssets } from './assets'

export function createConversationAssetsPager (_session: Session, _url: string, isCurrent: () => boolean) {
  let cursor = ''
  let done = false
  return {
    async loadNext (conversationID: string) {
      if (!isCurrent())
        throw new ProductError('assets.pageChangedReopen')
      if (done)
        return { assets: [], done }
      const page = await loadServerHistory({ conversationID, cursor })
      if (!isCurrent())
        throw new ProductError('assets.pageChangedReopen')
      cursor = page.cursor
      done = !page.hasMore
      return { assets: extractAssets(page.messages), done }
    },
  }
}
