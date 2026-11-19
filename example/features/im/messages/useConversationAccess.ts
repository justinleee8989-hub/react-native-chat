import { useCallback, useEffect, useRef, useState } from 'react'
import { directory, groupDirectoryEvents, subscribeDirectory } from '../application/directory'
import { profile } from '../application/profile'
import type { Conversation } from '../domain/types'
import type { MessageKey } from '../i18n'
import { ProductError } from '../shared/product-error.ts'

const accessEvents = [...groupDirectoryEvents, 'onBlackAdded', 'onBlackDeleted']
export function useConversationAccess (conversation: Conversation | undefined, userID: string) {
  // `notice`: why this user cannot send here, as a text's key; `error`: a failure to check, put into words by the screen.
  const [state, setState] = useState<{ notice: MessageKey | '', count?: number, error: unknown }>({ notice: 'access.syncing', error: '' })
  const revision = useRef(0)
  const alive = useRef(false)
  const groupID = conversation?.groupID
  const peer = conversation?.userID
  const refresh = useCallback(async () => {
    const version = ++revision.current
    try {
      let notice: MessageKey | '' = '', count: number | undefined
      if (groupID) {
        const [group, self] = await Promise.all([directory.group(groupID), directory.member(groupID, userID)])
        count = group?.memberCount
        if (group?.status === 2)
          notice = 'access.groupDismissed'
        else if (!group)
          notice = 'access.groupMissing'
        else if (group.status !== undefined && group.status !== 0 && group.status !== 3)
          notice = 'access.groupUnavailable'
        else if (!self)
          notice = 'access.notMember'
        else if (group.status === 3 && (self.roleLevel || 0) < 60)
          notice = 'access.allMuted'
        else if ((self?.muteEndTime || 0) / ((self?.muteEndTime || 0) > 100000000000 ? 1000 : 1) > Date.now() / 1000)
          notice = 'access.youMuted'
      } else if (peer) {
        const blocked = await profile.blacklist()
        if (blocked.some(person => person.userID === peer))
          notice = 'access.blocked'
      }
      if (alive.current && version === revision.current)
        setState({ notice, count, error: '' })
    } catch (failure) {
      if (alive.current && version === revision.current)
        setState(previous => ({ ...previous, notice: previous.notice && previous.notice !== 'access.syncing' ? previous.notice : 'access.unconfirmed', error: failure || new ProductError('error.generic') }))
    }
  }, [groupID, peer, userID])
  useEffect(() => {
    alive.current = true
    void refresh()
    const unsubscribe = subscribeDirectory(accessEvents, () => {
      void refresh()
    }, groupID)
    const timer = setInterval(() => {
      void refresh()
    }, 30000)
    return () => {
      alive.current = false; revision.current += 1; unsubscribe(); clearInterval(timer)
    }
  }, [refresh, groupID])
  return { ...state, refresh }
}
