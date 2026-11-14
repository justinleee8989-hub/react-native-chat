import type { Session } from '../domain/types'

export interface Reader { userID: string, nickname: string, faceURL: string, read: boolean }
export interface ReadersResult { members: Reader[], readCount: number, unreadCount: number, excludedJoinedLater: number }

export async function fetchMessageReaders (
  session: Session, baseURL: string, conversationID: string, messageID: string, seq: number
): Promise<ReadersResult> {
  if (!session.chatToken || !conversationID || !messageID || !Number.isSafeInteger(seq) || seq < 1)
    throw new Error('消息尚未同步或登录已失效，请重新进入会话')
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
      throw new Error(result.errMsg || '获取群已读明细失败，请重试')
    if (!Array.isArray(result.data?.members))
      throw new Error('群已读明细响应不完整，请重试')
    return result.data
  } finally {
    clearTimeout(timeout)
  }
}
