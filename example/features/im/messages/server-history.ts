import type { IMMessage, Session } from '../domain/types'
import { ProductError, ServerError } from '../shared/product-error.ts'

export interface ServerHistoryRequest {
  conversationID: string
  kind?: 'all' | 'text' | 'images' | 'files' | 'links'
  query?: string
  cursor?: string
  limit?: number
}
export interface ServerHistoryPage { messages: IMMessage[], hasMore: boolean, cursor: string }

export async function fetchServerHistory (session: Session, baseURL: string, request: ServerHistoryRequest): Promise<ServerHistoryPage> {
  if (!session.chatToken)
    throw new ProductError('history.serverSignedOut')
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30000)
  try {
    const response = await fetch(`${baseURL.replace(/\/$/, '')}/user/message/history`, {
      method: 'POST', signal: controller.signal,
      headers: { 'Content-Type': 'application/json', token: session.chatToken, operationID: `history-${Date.now()}` },
      body: JSON.stringify({ kind: 'all', query: '', limit: 100, ...request }),
    })
    const result = await response.json()
    if (!response.ok || result.errCode !== 0)
      // A server failure is explained by its code; a reply that is not one is said by us.
      throw result?.errCode ? new ServerError(result, response.status) : new ProductError('history.serverFailed')
    const page = result.data
    if (!Array.isArray(page?.messages) || typeof page.hasMore !== 'boolean' || typeof page.cursor !== 'string')
      throw new ProductError('history.serverIncomplete')
    if (page.hasMore && (!page.cursor || page.cursor === request.cursor))
      throw new ProductError('history.notAdvancing')
    return page
  } finally {
    clearTimeout(timeout)
  }
}
