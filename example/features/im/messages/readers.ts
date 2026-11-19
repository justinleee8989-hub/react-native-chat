import type { Session } from '../domain/types'
import { ProductError, ServerError } from '../shared/product-error.ts'

export interface Reader { userID: string, nickname: string, faceURL: string, read: boolean }
export interface ReadersResult { members: Reader[], readCount: number, unreadCount: number, excludedJoinedLater: number }

export async function fetchMessageReaders (
  session: Session, baseURL: string, conversationID: string, messageID: string, seq: number
): Promise<ReadersResult> {
  if (!session.chatToken || !conversationID || !messageID || !Number.isSafeInteger(seq) || seq < 1)
    throw new ProductError('readers.notSynced')
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30000)
  try {
    const response = await fetch(`${baseURL.replace(/\/$/, '')}/user/message/readers`, {
      method: 'POST', signal: controller.signal,
      headers: { 'Content-Type': 'application/json', token: session.chatToken, operationID: `readers-${Date.now()}` },
      body: JSON.stringify({ conversationID, messageID, seq }),
    })
    const result = await response.json()
    if (!response.ok || result.errCode !== 0)
      // A server failure is explained by its code; a reply that is not one is said by us.
      throw result?.errCode ? new ServerError(result, response.status) : new ProductError('readers.failed')
    if (!Array.isArray(result.data?.members))
      throw new ProductError('readers.incomplete')
    return result.data
  } finally {
    clearTimeout(timeout)
  }
}
