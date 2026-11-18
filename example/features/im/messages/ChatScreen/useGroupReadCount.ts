import { useCallback } from 'react'
import { loadServerHistory, syncMessageReaders } from '../../application/store'
import type { Conversation, GroupMessageReadInfo, IMMessage, Session } from '../../domain/types'
import { resolveExtraSequence } from '../extras'
import { useLatestGroupReaders } from '../useLatestGroupReaders'

/**
 * Keeps the read count under this user's latest group message current. It is asked on opening and
 * again whenever `refreshToken` moves: the app returning to the foreground, or the chat server
 * saying a member read past this user's messages (OpenIM itself tells the sender nothing).
 */
export function useGroupReadCount ({ id, conversation, session, chatURL, rawMessages, readInfo, refreshToken }: {
  id: string
  conversation?: Conversation
  session?: Session
  chatURL: string
  rawMessages: IMMessage[]
  readInfo?: Record<string, GroupMessageReadInfo>
  refreshToken: number
}) {
  const selfID = session?.userID
  // Not only messages with a local seq: the one just sent has none until the next sync, and it is
  // the one members are about to read.
  const latest = conversation?.groupID && selfID
    ? rawMessages.find(message =>
      message.sendID === selfID &&
      message.groupID === conversation.groupID &&
      message.status === 2 &&
      message.contentType < 1000)
    : undefined
  const resolveSeq = useCallback(
    (clientMsgID: string) => resolveExtraSequence({ clientMsgID }, cursor => loadServerHistory({ conversationID: id, cursor })),
    [id]
  )
  useLatestGroupReaders({
    session,
    chatURL,
    conversationID: id,
    message: latest,
    readInfo: latest ? readInfo?.[latest.clientMsgID] : undefined,
    enabled: !!conversation?.groupID,
    refreshToken,
    sync: syncMessageReaders,
    resolveSeq,
  })
}
