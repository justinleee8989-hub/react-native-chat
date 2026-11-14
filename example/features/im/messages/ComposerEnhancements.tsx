import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, FlatList, Modal, Pressable, Text, View } from 'react-native'
import type { PartialChatTheme } from '@kesha-antonov/react-native-chat'
import { createComposerState } from '../application/composer-state'
import { reportError } from '../application/store'
import type { Conversation } from '../domain/types'
import { changeInputState, createAtMessage, listGroupMembers, readDraft, subscribeInputStatus, writeDraft } from '../infrastructure/openim/composer-client'
import { getDraftStorageScope, clearDeliveredDraft, readDraftMentions, writeDraftMentions } from '../infrastructure/openim/composer-storage'

const drafts = createComposerState({ getScope: getDraftStorageScope, clearDelivered: clearDeliveredDraft, read: readDraft, write: writeDraft, readMentions: readDraftMentions, writeMentions: writeDraftMentions })

export interface ComposerMember {
  userID: string
  nickname: string
}

/**
 * Text uses OpenIM's conversation draft; selected @ IDs use account-scoped local storage.
 */
export function useComposerEnhancements (options: {
  userID: string
  conversation: Conversation
  typingThrottleMs?: number
  typingExpiryMs?: number
}) {
  const { userID, conversation } = options
  const [text, setText] = useState('')
  const [draftError, setDraftError] = useState<string | null>(null)
  const [draftRetry, setDraftRetry] = useState(0)
  const [members, setMembers] = useState<ComposerMember[]>([])
  const [membersLoading, setMembersLoading] = useState(false)
  const [membersError, setMembersError] = useState(false)
  const [membersRetry, setMembersRetry] = useState(0)
  const [selectedMentionIDs, setSelectedMentionIDs] = useState<string[]>([])
  const [typing, setTyping] = useState(false)
  const [typingError, setTypingError] = useState<string | null>(null)
  const [typingUsers, setTypingUsers] = useState<string[]>([])
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const draftClearTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const exitFlushTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const sending = useRef(false)
  const lastNonemptyDraft = useRef('')
  const draftRevision = useRef(0)
  const mentionRevision = useRef(0)
  const mentionIDsRef = useRef<string[]>([])
  const textRef = useRef('')
  const activeKey = useRef('')
  const lastTypingAt = useRef(0)
  const serverScope = getDraftStorageScope()
  const convID = conversation.conversationID
  const isGroup = Boolean(conversation.groupID)

  useEffect(() => {
    const identity = `${userID}\u0000${serverScope}\u0000${convID}`
    const sameIdentity = activeKey.current === identity
    if (sameIdentity && exitFlushTimer.current) {
      clearTimeout(exitFlushTimer.current)
      exitFlushTimer.current = undefined
    }
    activeKey.current = identity
    drafts.setUser(userID)
    const restoringAtRevision = draftRevision.current
    let current = true
    if (!sameIdentity) {
      setText('')
      textRef.current = ''
      mentionIDsRef.current = []
      setSelectedMentionIDs([])
    }
    const restoringMentionsAtRevision = mentionRevision.current
    setDraftError(null)
    void Promise.all([drafts.restore(convID), drafts.restoreMentions(convID)]).then(([draft, ids]) => {
      if (!current)
        return
      if (draftRevision.current === restoringAtRevision && (!sameIdentity || !textRef.current.trim())) {
        lastNonemptyDraft.current = draft
        textRef.current = draft
        setText(draft)
      }
      if (mentionRevision.current === restoringMentionsAtRevision && (!sameIdentity || !mentionIDsRef.current.length)) {
        mentionIDsRef.current = ids
        setSelectedMentionIDs(ids)
      }
      setDraftError(null)
    }).catch(error => {
      if (current)
        setDraftError(error instanceof Error ? error.message : '草稿或提醒对象恢复失败')
    })
    return () => {
      current = false
      if (timer.current)
        clearTimeout(timer.current)
      if (draftClearTimer.current)
        clearTimeout(draftClearTimer.current)
      const draftAtExit = textRef.current
      const sendWasPending = sending.current
      exitFlushTimer.current = setTimeout(() => {
        exitFlushTimer.current = undefined
        if (activeKey.current === identity && getDraftStorageScope() === serverScope)
          void drafts.flushOnExit(userID, convID, draftAtExit, sendWasPending, serverScope).catch(reportError)
      }, 0)
      if (userID && convID)
        void changeInputState(convID, false).catch(error => setDraftError(error instanceof Error ? error.message : '草稿保存失败，请重试'))
    }
  }, [userID, serverScope, convID, draftRetry])

  useEffect(() => {
    let current = true
    if (!isGroup || !conversation.groupID) {
      setMembers([])
      setMembersError(false)
      setMembersLoading(false)
      return () => {
        current = false
      }
    }
    setMembers([])
    setMembersError(false)
    setMembersLoading(true)
    void listGroupMembers(conversation.groupID).then(value => {
      if (current) {
        setMembers(value)
        setMembersLoading(false)
      }
    }).catch(() => {
      if (current) {
        setMembersError(true)
        setMembersLoading(false)
      }
    })
    return () => {
      current = false
    }
  }, [userID, isGroup, conversation.groupID, membersRetry])

  useEffect(() => {
    const expirations = new Map<string, ReturnType<typeof setTimeout>>()
    setTypingUsers([])
    const unsubscribe = subscribeInputStatus(status => {
      if (status.conversationID !== convID || status.userID === userID)
        return
      if (status.platformIDs?.length === 0) {
        if (expirations.has(status.userID))
          clearTimeout(expirations.get(status.userID))
        expirations.delete(status.userID)
        setTypingUsers(previous => previous.filter(id => id !== status.userID))
        return
      }
      if (expirations.has(status.userID))
        clearTimeout(expirations.get(status.userID))
      setTypingUsers(previous => previous.includes(status.userID) ? previous : [...previous, status.userID])
      expirations.set(status.userID, setTimeout(() => {
        expirations.delete(status.userID)
        setTypingUsers(previous => previous.filter(id => id !== status.userID))
      }, options.typingExpiryMs ?? 7000))
    })
    return () => {
      unsubscribe()
      expirations.forEach(clearTimeout)
    }
  }, [convID, userID, options.typingExpiryMs])

  const typingFailureReported = useRef(false)
  const publishInputState = useCallback((focus: boolean) => {
    void changeInputState(convID, focus).then(() => {
      typingFailureReported.current = false
      setTypingError(null)
    }).catch(error => {
      if (typingFailureReported.current)
        return
      typingFailureReported.current = true
      setTypingError(error instanceof Error ? error.message : '输入状态上报失败')
    })
  }, [convID])

  const stopTyping = useCallback(() => {
    if (timer.current)
      clearTimeout(timer.current)
    timer.current = undefined
    setTyping(false)
    if (convID)
      publishInputState(false)
  }, [convID, publishInputState])

  const startTyping = useCallback(() => {
    const now = Date.now()
    if (now - lastTypingAt.current >= (options.typingThrottleMs ?? 2500)) {
      lastTypingAt.current = now
      setTyping(true)
      publishInputState(true)
    }
    if (timer.current)
      clearTimeout(timer.current)
    timer.current = setTimeout(stopTyping, options.typingExpiryMs ?? 7000)
  }, [options.typingExpiryMs, options.typingThrottleMs, publishInputState, stopTyping])

  const onDraftChange = useCallback((value: string) => {
    draftRevision.current += 1
    textRef.current = value
    setText(value)
    if (value.trim()) {
      lastNonemptyDraft.current = value
      if (draftClearTimer.current)
        clearTimeout(draftClearTimer.current)
      void drafts.save(convID, value).catch(error => setDraftError(error instanceof Error ? error.message : '草稿保存失败，请重试'))
      startTyping()
    } else {
      stopTyping()
      if (draftClearTimer.current)
        clearTimeout(draftClearTimer.current)
      draftClearTimer.current = setTimeout(() => {
        if (!sending.current)
          void drafts.save(convID, '').catch(error => setDraftError(error instanceof Error ? error.message : '草稿保存失败，请重试'))
      }, 750)
    }
  }, [convID, startTyping, stopTyping])

  const sendWithDraft = useCallback(async <T,>(sendMessage: () => Promise<T>) => {
    if (draftClearTimer.current)
      clearTimeout(draftClearTimer.current)
    sending.current = true
    const requestKey = `${userID}\u0000${serverScope}\u0000${convID}`
    const revisionAtSend = draftRevision.current
    const mentionRevisionAtSend = mentionRevision.current
    const draftAtSend = lastNonemptyDraft.current
    const reportCleanupError = () => {
      if (activeKey.current === requestKey)
        reportError(new Error('消息已发送，草稿清理失败；请勿重复发送'))
    }
    try {
      const result = await drafts.send(convID, sendMessage, reportCleanupError)
      if (activeKey.current === requestKey && draftRevision.current === revisionAtSend) {
        lastNonemptyDraft.current = ''
        textRef.current = ''
        setText('')
        stopTyping()
      }
      const clearMentionsAfterSend = activeKey.current === requestKey && mentionRevision.current === mentionRevisionAtSend && (draftRevision.current === revisionAtSend || !textRef.current.trim())
      if (clearMentionsAfterSend) {
        mentionIDsRef.current = []
        setSelectedMentionIDs([])
        if (draftRevision.current !== revisionAtSend)
          await drafts.saveMentions(convID, []).catch(reportCleanupError)
      }
      if (activeKey.current === requestKey && draftRevision.current !== revisionAtSend && !textRef.current.trim())
        await drafts.save(convID, '').catch(reportCleanupError)
      return result
    } catch (error) {
      if (activeKey.current === requestKey && draftRevision.current === revisionAtSend) {
        textRef.current = draftAtSend
        setText(draftAtSend)
        await drafts.save(convID, draftAtSend)
      }
      throw error
    } finally {
      sending.current = false
    }
  }, [userID, serverScope, convID, stopTyping])

  const buildAtMessage = useCallback((value: string, selected = members.filter(member => selectedMentionIDs.includes(member.userID))) => {
    if (!isGroup)
      return Promise.reject(new Error('@ 提醒仅支持群聊'))
    if (membersLoading)
      return Promise.reject(new Error('群成员仍在加载'))
    if (membersError)
      return Promise.reject(new Error('群成员加载失败，请重试'))
    const valid = selected.filter(member => members.some(candidate => candidate.userID === member.userID))
    if (!valid.length)
      return Promise.reject(new Error('请选择当前群成员'))
    return createAtMessage(value, valid)
  }, [isGroup, members, membersLoading, membersError, selectedMentionIDs])
  const selectMention = useCallback((member: ComposerMember) => {
    if (!members.some(candidate => candidate.userID === member.userID))
      return
    const ids = [...new Set([...mentionIDsRef.current, member.userID])]
    mentionIDsRef.current = ids
    mentionRevision.current += 1
    setSelectedMentionIDs(ids)
    void drafts.saveMentions(convID, ids).catch(error => setDraftError(error instanceof Error ? error.message : '草稿保存失败，请重试'))
  }, [convID, members])
  const clearMentions = useCallback(() => {
    mentionIDsRef.current = []
    mentionRevision.current += 1
    setSelectedMentionIDs([])
    void drafts.saveMentions(convID, []).catch(error => setDraftError(error instanceof Error ? error.message : '草稿保存失败，请重试'))
  }, [convID])
  const selectedMentions = useMemo(() => members.filter(member => selectedMentionIDs.includes(member.userID)), [members, selectedMentionIDs])
  const retryMembers = useCallback(() => setMembersRetry(value => value + 1), [])
  const retryDraft = useCallback(() => {
    if (!textRef.current && !mentionIDsRef.current.length) {
      setDraftRetry(value => value + 1)
      return
    }
    void drafts.save(convID, textRef.current).then(() => drafts.saveMentions(convID, mentionIDsRef.current)).then(() => setDraftError(null)).catch(error => setDraftError(error instanceof Error ? error.message : '草稿保存失败，请重试'))
  }, [convID])
  const restore = useCallback(async () => {
    setDraftRetry(value => value + 1)
  }, [])
  const typingUserItems = useMemo(() => typingUsers.map(id => ({
    _id: id,
    name: members.find(member => member.userID === id)?.nickname || (id === conversation.userID ? conversation.showName : id),
  })), [typingUsers, members, conversation.userID, conversation.showName])

  return useMemo(() => ({
    text,
    onDraftChange,
    onFocus: startTyping,
    onBlur: stopTyping,
    sendWithDraft,
    restore,
    draftError,
    retryDraft,
    typingError,
    buildAtMessage,
    membersForGroup: members,
    membersLoading,
    membersError,
    retryMembers,
    selectedMentions,
    selectMention,
    clearMentions,
    isTyping: typingUserItems.length > 0,
    isTypingSelf: typing,
    typingUsers: typingUserItems,
  }), [text, onDraftChange, startTyping, stopTyping, sendWithDraft, restore, draftError, retryDraft, typingError, buildAtMessage, members, membersLoading, membersError, retryMembers, selectedMentions, selectMention, clearMentions, typing, typingUserItems])
}

export function MentionPicker (props: {
  visible: boolean
  groupID: string
  onClose: () => void
  onSelect: (member: ComposerMember) => void
  theme?: PartialChatTheme
}) {
  const [members, setMembers] = useState<ComposerMember[]>([])
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let current = true
    if (!props.visible)
      return () => {
        current = false
      }
    setMembers([])
    setFailed(false)
    setLoading(true)
    void listGroupMembers(props.groupID).then(value => {
      if (current) {
        setMembers(value)
        setLoading(false)
      }
    }).catch(() => {
      if (current) {
        setFailed(true)
        setLoading(false)
      }
    })
    return () => {
      current = false
    }
  }, [props.visible, props.groupID, attempt])
  return <Modal visible={props.visible} transparent animationType='slide' onRequestClose={props.onClose}>
    <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: '#0006' }}>
      <View style={{ maxHeight: '70%', backgroundColor: props.theme?.colors?.surface || props.theme?.colors?.background || 'white', padding: 16 }}>
        <FlatList
          data={members}
          keyExtractor={member => member.userID}
          renderItem={({ item }) => <Pressable onPress={() => {
            props.onSelect(item); props.onClose()
          }} style={{ paddingVertical: 12 }}
          >
            <Text style={{ color: props.theme?.colors?.inputText }}>{item.nickname}</Text>
          </Pressable>}
          ListEmptyComponent={loading
            ? <View style={{ paddingVertical: 18, alignItems: 'center' }}><ActivityIndicator /><Text style={{ color: props.theme?.colors?.inputText, marginTop: 8 }}>正在加载群成员…</Text></View>
            : failed
              ? <View style={{ paddingVertical: 18, alignItems: 'center' }}>
                <Text style={{ color: props.theme?.colors?.inputText }}>群成员加载失败，请检查连接后重试</Text>
                <Pressable onPress={() => setAttempt(value => value + 1)} style={{ padding: 12 }}><Text style={{ color: props.theme?.colors?.accent }}>重试</Text></Pressable>
              </View>
              : <Text style={{ color: props.theme?.colors?.inputText }}>没有可提醒的群成员</Text>}
        />
        <Pressable onPress={props.onClose} style={{ paddingVertical: 12 }}><Text style={{ color: props.theme?.colors?.inputText }}>取消</Text></Pressable>
      </View>
    </View>
  </Modal>
}
