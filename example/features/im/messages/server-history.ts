import type { IMMessage, Session } from '../domain/types'

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
    throw new Error('登录已失效，请重新登录')
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
      throw new Error(result.errMsg || '读取服务端历史失败，请重试')
    const page = result.data
    if (!Array.isArray(page?.messages) || typeof page.hasMore !== 'boolean' || typeof page.cursor !== 'string')
      throw new Error('服务端历史响应不完整，请重试')
    if (page.hasMore && (!page.cursor || page.cursor === request.cursor))
      throw new Error('历史分页未前进，请重试')
    return page
  } finally {
    clearTimeout(timeout)
  }
}
