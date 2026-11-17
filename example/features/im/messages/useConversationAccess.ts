import { useCallback, useEffect, useRef, useState } from 'react'
import { directory, groupDirectoryEvents, subscribeDirectory } from '../application/directory'
import { profile } from '../application/profile'
import type { Conversation } from '../domain/types'
import { errorMessage } from '../shared/error-message'

const accessEvents = [...groupDirectoryEvents, 'onBlackAdded', 'onBlackDeleted']
export function useConversationAccess (conversation: Conversation | undefined, userID: string) {
  const [state, setState] = useState<{ notice: string, count?: number, error: string }>({ notice: '正在同步会话权限…', error: '' })
  const revision = useRef(0)
  const alive = useRef(false)
  const groupID = conversation?.groupID
  const peer = conversation?.userID
  const refresh = useCallback(async () => {
    const version = ++revision.current
    try {
      let notice = '', count: number | undefined
      if (groupID) {
        const [group, self] = await Promise.all([directory.group(groupID), directory.member(groupID, userID)])
        count = group?.memberCount
        if (group?.status === 2)
          notice = '群聊已解散，无法发送消息'
        else if (!group)
          notice = '群聊不可用，无法发送消息'
        else if (group.status !== undefined && group.status !== 0 && group.status !== 3)
          notice = '群聊当前不可用，无法发送消息'
        else if (!self)
          notice = '你已不在群聊中，无法发送消息'
        else if (group.status === 3 && (self.roleLevel || 0) < 60)
          notice = '全员禁言中'
        else if ((self?.muteEndTime || 0) / ((self?.muteEndTime || 0) > 100000000000 ? 1000 : 1) > Date.now() / 1000)
          notice = '你已被禁言，暂时无法发送消息'
      } else if (peer) {
        const blocked = await profile.blacklist()
        if (blocked.some(person => person.userID === peer))
          notice = '已加入黑名单，无法发送消息'
      }
      if (alive.current && version === revision.current)
        setState({ notice, count, error: '' })
    } catch (failure) {
      if (alive.current && version === revision.current)
        setState(previous => ({ ...previous, notice: previous.notice && previous.notice !== '正在同步会话权限…' ? previous.notice : '会话权限暂未确认，请重试', error: errorMessage(failure) }))
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
